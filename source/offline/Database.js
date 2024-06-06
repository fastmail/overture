/*global indexedDB */

class Database {
    // name: string
    // version: number
    // setup: (db,oldVersion,newVersion)
    // needsUpdate (optional)
    constructor(mixin) {
        this._db = null;
        Object.assign(this, mixin);
    }

    needsUpdate() {}

    open() {
        if (this._db) {
            return this._db;
        }
        const _db = new Promise((resolve, reject) => {
            const name = this.name;
            const request = indexedDB.open(name, this.version);
            request.onupgradeneeded = (event) => {
                const db = request.result;
                this.setup(
                    db,
                    event.newVersion,
                    event.oldVersion,
                    request.transaction,
                );
            };
            request.onsuccess = () => {
                const db = request.result;
                this.objectStoreNames = db.objectStoreNames;
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
        if (!storeNames) {
            storeNames = this.objectStoreNames;
        }
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            transaction.onabort = () => {
                reject(transaction.error);
            };
            transaction.oncomplete = () => {
                resolve();
            };
            try {
                await fn(transaction);
                transaction.commit();
            } catch (error) {
                reject(error);
                transaction.abort();
            }
        });
    }

    async close() {
        const _db = this._db;
        if (_db) {
            this._db = null;
            const db = await _db;
            db.close();
        }
    }
}

const promisify = (request) =>
    new Promise((resolve, reject) => {
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

export { Database, promisify, iterate };
