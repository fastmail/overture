import { platform } from '../ua/UA.js';

// ---

/*global indexedDB, DOMException */

// https://bugs.webkit.org/show_bug.cgi?id=288682
// In WebKit, if the worker running the transaction is killed, it does not
// perform micro tasks, so promise resolution never happens, and it ends up
// thinking there are no more requests so automatically commits the transaction.
const needsKeepAlive = platform === 'ios';

const closedError = () =>
    new DOMException('The database has been closed', 'DatabaseClosedError');

const isDatabaseClosed = (error) => error?.name === 'DatabaseClosedError';

class Database {
    // name: string
    // version: number
    // setup: (db,oldVersion,newVersion)
    // needsUpdate (optional)
    // didReset (optional)
    constructor(mixin) {
        this._db = null;
        this._transactions = new Set();
        this._hasOpened = false;
        // While closed, open() and transaction() reject with a
        // DatabaseClosedError, as do transactions already waiting to start
        // or aborted by the close, rather than lazily reopening it.
        this.isClosed = false;
        // Set when an open finds the database newly created after an
        // earlier open succeeded, i.e. the browser deleted or cleared it.
        // This instance then closes for good, so nothing built on the lost
        // contents can touch the new database, and calls didReset so the
        // owner can start afresh with a new instance.
        this.isReset = false;
        Object.assign(this, mixin);
    }

    needsUpdate() {}

    didReset() {}

    open() {
        if (this.isClosed) {
            return Promise.reject(closedError());
        }
        if (this._db) {
            return this._db;
        }
        const _db = new Promise((resolve, reject) => {
            let isReset = false;
            const name = this.name;
            const request = indexedDB.open(name, this.version);
            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!event.oldVersion && this._hasOpened) {
                    isReset = true;
                }
                this.setup(
                    db,
                    event.newVersion,
                    event.oldVersion,
                    request.transaction,
                );
            };
            request.onsuccess = () => {
                const db = request.result;
                if (isReset) {
                    db.close();
                    this.isReset = true;
                    this.isClosed = true;
                    if (this._db === _db) {
                        this._db = null;
                    }
                    reject(closedError());
                    this.didReset();
                    return;
                }
                this._hasOpened = true;
                this.objectStoreNames = Array.from(db.objectStoreNames);
                db.onversionchange = () => this.needsUpdate();
                db.onclose = () => {
                    if (this._db === _db) {
                        this._db = null;
                    }
                };
                resolve(db);
            };
            request.onerror = () => reject(request.error);
        });
        _db.catch(() => {
            if (this._db === _db) {
                this._db = null;
            }
        });
        this._db = _db;
        return _db;
    }

    // Mode = readwrite or readonly
    async transaction(storeNames, mode, fn) {
        const db = await this.open();
        // Closed while we waited for it to open
        if (this.isClosed) {
            throw closedError();
        }
        if (!storeNames) {
            storeNames = this.objectStoreNames;
        } else if (typeof storeNames === 'string') {
            storeNames = [storeNames];
        }
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            this._transactions.add(transaction);
            let fnError = null;
            transaction.onabort = () => {
                // WebKit aborts with no error if its indexedDB server drops
                // the transaction; only close() should do that silently. Not
                // a DOMException, as that may have a stack, and a stackless
                // AbortError is how callers recognise a killed transaction.
                const isClosing = !this._transactions.delete(transaction);
                reject(
                    isClosing
                        ? closedError()
                        : transaction.error ||
                              fnError || {
                                  name: 'AbortError',
                                  message: 'Transaction aborted without error',
                              },
                );
            };
            transaction.oncomplete = () => {
                this._transactions.delete(transaction);
                resolve();
            };

            // Keep-alive for WebKit bug
            let shouldKeepTransactionAlive =
                needsKeepAlive && mode === 'readwrite';
            function keepTransactionAlive(txn) {
                if (!shouldKeepTransactionAlive) {
                    return;
                }
                const request = txn.objectStore(storeNames[0]).get('');
                request.onsuccess = (event) => {
                    keepTransactionAlive(event.target.transaction);
                };
            }

            try {
                keepTransactionAlive(transaction);
                await fn(transaction);
                shouldKeepTransactionAlive = false;
                transaction.commit();
            } catch (error) {
                shouldKeepTransactionAlive = false;
                if (this.isClosed) {
                    // Whatever fn tripped over, it's because we closed
                    reject(closedError());
                    try {
                        transaction.abort();
                    } catch (abortError) {}
                } else if (error?.name === 'AbortError') {
                    // The transaction was aborted, probably because another
                    // request in it failed; onabort rejects with that error
                    // (the root cause) instead.
                    fnError = error;
                    try {
                        transaction.abort();
                    } catch (abortError) {
                        // Already aborted
                    }
                } else {
                    reject(error);
                    transaction.abort();
                }
            }
        });
    }

    // Undoes close(); the database itself is opened on next use
    reopen() {
        this.isClosed = false;
        this.isReset = false;
    }

    async close() {
        this.isClosed = true;
        const _db = this._db;
        if (_db) {
            this._transactions.forEach((transaction) => {
                this._transactions.delete(transaction);
                // This will throw an InvalidStateError if the transaction
                // has already completed/aborted
                try {
                    transaction.abort();
                } catch (error) {}
            });
            this._db = null;
            const db = await _db.catch(() => null);
            db?.close();
        }
    }
}

const promisify = (request) =>
    new Promise((resolve, reject) => {
        if (request.readyState === 'done') {
            if (request.error) {
                reject(request.error);
            } else {
                resolve(request.result);
            }
            return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const iterate = async function* (cursor) {
    while (true) {
        const result = await promisify(cursor);
        if (!result) {
            break;
        }
        yield result;
        result.continue();
    }
};

export { Database, isDatabaseClosed, promisify, iterate };
