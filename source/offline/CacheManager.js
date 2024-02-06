import { Database, iterate, promisify as _ } from './Database.js';

/*global caches, fetch, setTimeout, Request, Response */

const bearerParam = /[?&]access_token=[^&]+/;
const downloadParam = /[?&]download=1\b/;

const processResponse = (request, response) => {
    const requestUrl = request.url;
    const isDownload = downloadParam.test(requestUrl);
    // Firefox uses the response url for the "View image" context menu action.
    // This may have an outdated access_token param and so fail, because we
    // ignore this when pulling it out of the cache. If you just create a new
    // Response object, it will have a null url, which causes Firefox to
    // fallback to the request url (there's no way to set the url explicitly on
    // a new Response object).
    if (isDownload || requestUrl !== response.url) {
        response = new Response(response.body, response);
        if (isDownload) {
            response.headers.set('Content-Disposition', 'attachment');
        }
    }
    return response;
};

const removeSearch = (url) => url.replace(/[?].*$/, '');

class CacheManager {
    constructor(rules) {
        for (const key in rules) {
            rules[key].expiryInProgress = 0;
        }
        this.rules = rules;
        this.db = new Database({
            name: 'CacheExpiration',
            version: 1,
            setup(db /*, newVersion, oldVersion, transaction*/) {
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
        const cacheUrl =
            rules && rules.ignoreSearch
                ? removeSearch(request.url)
                : request.url
                      .replace(bearerParam, '')
                      .replace(downloadParam, '');
        const response = await cache.match(cacheUrl);
        if (response) {
            if (rules) {
                this.setIn(cacheName, cacheUrl, null, request);
            }
            return processResponse(request, response);
        }
        if (!rules) {
            return fetch(request);
        }
        return this.fetchAndCacheIn(cacheName, request);
    }

    async fetchAndCacheIn(cacheName, request) {
        const ignoreSearch = this.rules[cacheName].ignoreSearch;
        const requestUrl = request.url;
        let fetchUrl = ignoreSearch
            ? removeSearch(requestUrl)
            : requestUrl.replace(downloadParam, '');
        if (request.mode === 'no-cors' || fetchUrl !== requestUrl) {
            request = new Request(fetchUrl, {
                mode: 'cors',
                referrer: 'no-referrer',
            });
        }
        let response = await fetch(request);
        // Cache if valid
        if (response && response.status === 200) {
            fetchUrl = fetchUrl.replace(bearerParam, '');
            this.setIn(cacheName, fetchUrl, response.clone(), null);
            response = processResponse(request, response);
        }
        return response;
    }

    async putIn(cacheName, cacheUrl, response) {
        if (response) {
            // TODO: Handle quota error
            const cache = await caches.open(cacheName);
            await cache.put(cacheUrl, response);
        }
    }

    async setIn(cacheName, cacheUrl, response, request) {
        const rules = this.rules[cacheName];
        if (rules.noExpire) {
            this.putIn(cacheName, cacheUrl, response);
            return;
        }
        const db = this.db;
        await db.transaction(cacheName, 'readwrite', async (transaction) => {
            const store = transaction.objectStore(cacheName);
            const existing = await _(store.get(cacheUrl));
            const now = Date.now();
            const created = existing && !response ? existing.created : now;
            const maxLastAccess = rules.maxLastAccess;
            // We've already returned the result, but if it should have expired,
            // don't update the cache time so we'll flush it from the cache
            // before next time.
            if (
                response ||
                !existing ||
                !maxLastAccess ||
                existing.lastAccess + 1000 * maxLastAccess >= now
            ) {
                store.put({
                    url: cacheUrl,
                    created,
                    lastAccess: now,
                });
            }
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
        await this.putIn(cacheName, cacheUrl, response);
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
                if (entry.lastAccess < minLastAccess || count >= maxNumber) {
                    entriesToDelete.push(entry);
                } else {
                    count += 1;
                }
            }
        });
        if (entriesToDelete.length) {
            const cache = await caches.open(cacheName);
            await Promise.all(
                entriesToDelete.map(({ url }) => cache.delete(url)),
            );
            await db.transaction(
                cacheName,
                'readwrite',
                async (transaction) => {
                    const store = transaction.objectStore(cacheName);
                    // We check the lastAccess time has not changed so we don't
                    // delete an updated entry if setInCache has interleaved.
                    await Promise.all(
                        entriesToDelete.map(async (entryToDelete) => {
                            const key = entryToDelete.url;
                            const entry = await _(store.get(key));
                            if (entry.lastAccess === entryToDelete.lastAccess) {
                                await _(store.delete(key));
                            }
                        }),
                    );
                },
            );
        }
        if (rules.expiryInProgress > 1) {
            setTimeout(() => this.removeExpiredIn(cacheName), 0);
        }
        rules.expiryInProgress = 0;
    }
}

export { CacheManager };
