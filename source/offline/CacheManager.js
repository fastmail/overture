import { Database, iterate, promisify as _ } from './Database.js';

/*global caches, fetch, setTimeout, Response */

class CacheManager {
    constructor(rules) {
        for (const key in rules) {
            rules[key].expiryInProgress = 0;
        }
        this.rules = rules;
        this.db = new Database({
            name: 'CacheExpiration',
            version: 1,
            setup(db /*, newVersion, oldVersion*/) {
                for (const cacheName in rules) {
                    if (rules.noExpire) {
                        continue;
                    }
                    const store = db.createObjectStore(cacheName, {
                        keyPath: 'url',
                    });
                    store.createIndex('byLastUsed', 'lastAccess');
                }
            },
        });
    }

    async getIn(cacheName, request) {
        const rules = this.rules[cacheName];
        const cache = await caches.open(cacheName);
        let response = await cache.match(request, { ignoreSearch: true });
        if (!rules) {
            return response || fetch(request);
        }
        if (response) {
            this.setIn(cacheName, request, null);
            if (/[?&]download=1\b/.test(request.url)) {
                response = new Response(response.body, response);
                response.headers.set('Content-Disposition', 'attachment');
            }
            return response;
        }
        return this.fetchAndCacheIn(cacheName, request);
    }

    async fetchAndCacheIn(cacheName, request) {
        const response = await fetch(request);
        // Cache if valid
        if (response && response.status < 400) {
            let clone = response.clone();
            if (clone.headers.has('Content-Disposition')) {
                clone = new Response(response.body, response);
                clone.headers.delete('Content-Disposition');
            }
            this.setIn(cacheName, request, clone);
        }
        return response;
    }

    async putIn(cacheName, request, response) {
        if (response) {
            // TODO: Handle quota error
            const cache = await caches.open(cacheName);
            await cache.put(request, response);
        }
    }

    async setIn(cacheName, request, response) {
        const rules = this.rules[cacheName];
        if (rules.noExpire) {
            this.putIn(cacheName, request, response);
            return;
        }
        const db = this.db;
        await db.transaction(cacheName, 'readwrite', async (transaction) => {
            const store = transaction.objectStore(cacheName);
            const url = request.url;
            const existing = await _(store.get(url));
            const now = Date.now();
            const created = existing && !response ? existing.created : now;
            store.put({
                url,
                created,
                lastAccess: now,
            });
            if (
                rules.refetchIfOlderThan &&
                created + 1000 * rules.refetchIfOlderThan < now
            ) {
                this.fetchAndCacheIn(cacheName, request);
            }
        });
        // Wait for transaction to complete before adding to cache to ensure
        // anything in the cache is definitely tracked in the db so can be
        // cleaned up.
        await this.putIn(cacheName, request, response);
        this.removeExpiredIn(cacheName);
    }

    async removeExpiredIn(cacheName) {
        const rules = this.rules[cacheName];
        // This is safe because we're always dispatched from the sw thread. If
        // this gets called while expiry is already in progress, wait until the
        // end then run it again.
        rules.expiryInProgress += 1;
        if (rules.expiryInProgress > 1) {
            return;
        }
        const db = this.db;
        const maxLastAccess = rules.maxLastAccess;
        const maxNumber = rules.maxNumber || Infinity;
        const minLastAccess = maxLastAccess
            ? Date.now() - 1000 * maxLastAccess
            : 0;
        const entriesToDelete = [];
        await db.transaction(cacheName, 'readonly', async (transaction) => {
            // Iterate starting from most recently used
            const cursor = transaction
                .objectStore(cacheName)
                .index('byLastUsed')
                .openCursor(null, 'prev');
            let count = 0;
            for await (const result of iterate(cursor)) {
                const entry = result.value;
                if (entry.lastAccess < minLastAccess || count > maxNumber) {
                    entriesToDelete.push(entry);
                } else {
                    count += 1;
                }
            }
        });
        const cache = await caches.open(cacheName);
        await Promise.all(entriesToDelete.map(({ url }) => cache.delete(url)));
        await db.transaction(cacheName, 'readwrite', async (transaction) => {
            const store = transaction.objectStore(cacheName);
            // We check the lastAccess time has not changed so we don't delete
            // an updated entry if setInCache has interleaved.
            entriesToDelete.forEach(async (entryToDelete) => {
                const key = entryToDelete.url;
                const entry = await _(store.get(key));
                if (entry.lastAccess === entryToDelete.lastAccess) {
                    store.delete(key);
                }
            });
        });
        if (rules.expiryInProgress > 1) {
            setTimeout(() => this.removeExpiredIn(cacheName), 0);
        }
        rules.expiryInProgress = 0;
    }
}

export { CacheManager };
