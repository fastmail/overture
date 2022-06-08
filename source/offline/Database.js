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
                this.setup(db, event.newVersion, event.oldVersion);
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => this.needsUpdate();
                resolve(db);
            };
            request.onerror = () => reject(request.errorCode);
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
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeNames, mode);
            transaction.onabort = () => reject(transaction.error);
            transaction.oncomplete = () => resolve();
            fn(transaction);
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
        request.onerror = () => reject(request.errorCode);
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
