import { Database, promisify as _ } from './Database.js';

/*global caches, fetch, setTimeout, Request, Response, navigator, IDBKeyRange,
    console */

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

const META_ID = '';

class CacheManager {
    constructor(rules) {
        // Expiry rules
        this.rules = rules;
        // Timestamp for when next async update should run
        this.nextUpdate = 0;
        // Set of cacheNames that need expiry
        this.needsExpiry = new Set();
        // Map of cacheName -> Set(url)
        this.needsAccessUpdate = new Map();
        // DB to store expiry data
        this.db = new Database({
            name: 'CacheExpiration',
            version: 3,
            async setup(db, newVersion, oldVersion /* , transaction */) {
                const cacheNames = Object.keys(rules);
                if (oldVersion) {
                    for (const cacheName of cacheNames) {
                        if (db.objectStoreNames.contains(cacheName)) {
                            db.deleteObjectStore(cacheName);
                            caches.delete(cacheName);
                        }
                    }
                }
                for (const cacheName of cacheNames) {
                    const store = db.createObjectStore(cacheName, {
                        keyPath: 'url',
                    });
                    store.createIndex('byLastUsed', 'lastAccess');
                    store.put({
                        url: META_ID,
                        created: 0,
                        lastAccess: Infinity,
                        size: 0,
                        noExpire: true,
                    });
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
                let urls = this.needsAccessUpdate.get(cacheName);
                if (!urls) {
                    urls = new Set();
                    this.needsAccessUpdate.set(cacheName, urls);
                }
                urls.add(cacheUrl);
                this.needsUpdate(false);
            }
            return processResponse(request, response);
        }
        if (!rules) {
            return fetch(request);
        }
        return this.fetchAndCacheIn(cacheName, request, false);
    }

    async fetchAndCacheIn(cacheName, request, isUpdatingExisting) {
        const ignoreSearch = this.rules[cacheName].ignoreSearch;
        const requestUrl = request.url;
        const fetchUrl = ignoreSearch
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
            const cacheUrl = fetchUrl.replace(bearerParam, '');
            this.setIn(cacheName, cacheUrl, response.clone());
            response = processResponse(request, response);
        }
        // Remove if the resource has now gone
        if (isUpdatingExisting && response && response.status === 404) {
            const db = this.db;
            const cacheUrl = fetchUrl.replace(bearerParam, '');
            const cache = await caches.open(cacheName);
            await cache.delete(cacheUrl);
            await db.transaction(
                cacheName,
                'readwrite',
                async (transaction) => {
                    const store = transaction.objectStore(cacheName);
                    const [meta, existing] = await Promise.all([
                        _(store.get(META_ID)),
                        _(store.get(cacheUrl)),
                    ]);
                    if (existing) {
                        meta.created -= 1;
                        meta.size -= existing.size;
                        await Promise.all([
                            _(store.delete(cacheUrl)),
                            _(store.put(meta)),
                        ]);
                    }
                },
            );
        }
        return response;
    }

    async setIn(cacheName, cacheUrl, response, noExpire) {
        const db = this.db;
        const rules = this.rules[cacheName];
        let needsExpiry = !!rules.maxLastAccess;
        let currentSize = 0;
        await db.transaction(cacheName, 'readwrite', async (transaction) => {
            const store = transaction.objectStore(cacheName);
            const [meta, existing] = await Promise.all([
                _(store.get(META_ID)),
                _(store.get(cacheUrl)),
            ]);
            const now = Date.now();
            const size =
                parseInt(response.headers.get('Content-Length'), 10) || 0;
            if (existing) {
                meta.size -= existing.size;
                if (noExpire === undefined) {
                    noExpire = existing.noExpire;
                }
            } else {
                meta.created += 1;
            }
            meta.size += size;
            if (meta.size > rules.maxSize || meta.created > rules.maxNumber) {
                needsExpiry = true;
            }
            await Promise.all([
                _(store.put(meta)),
                _(
                    store.put({
                        url: cacheUrl,
                        created: now,
                        lastAccess: now,
                        size,
                        noExpire: !!noExpire,
                    }),
                ),
            ]);
            currentSize = meta.size;
        });
        // Wait for transaction to complete before adding to cache to ensure
        // anything in the cache is definitely tracked in the db so can be
        // cleaned up.
        const cache = await caches.open(cacheName);
        try {
            await cache.put(cacheUrl, response);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                await this.adjustMaxSize(cacheName, currentSize);
                needsExpiry = true;
            }
        }
        if (needsExpiry) {
            this.needsExpiry.add(cacheName);
            this.needsUpdate(false);
        }
    }

    async setNoExpire(cacheName, cacheUrls, noExpire, isUnwanted) {
        const db = this.db;
        return db.transaction(cacheName, 'readwrite', async (transaction) => {
            const store = transaction.objectStore(cacheName);
            const existing = await Promise.all(
                cacheUrls.map((cacheUrl) => _(store.get(cacheUrl))),
            );
            let last = null;
            for (const record of existing) {
                if (record) {
                    record.noExpire = noExpire;
                    if (isUnwanted) {
                        record.lastAccess = 0;
                    }
                    last = store.put(record);
                }
            }
            if (last) {
                await _(last);
            }
        });
    }

    // ---

    needsUpdate(forceTimeout) {
        if (forceTimeout || !this.nextUpdate) {
            setTimeout(this.update.bind(this), 1000);
        }
        this.nextUpdate = Date.now() + 1000;
    }

    async update() {
        const nextUpdate = this.nextUpdate;
        const msToUpdate = nextUpdate - Date.now();
        if (msToUpdate > 10) {
            setTimeout(this.update.bind(this), msToUpdate);
            return;
        }
        const needsAccessUpdate = this.needsAccessUpdate;
        if (needsAccessUpdate.size) {
            this.needsAccessUpdate = new Map();
            await this.bumpLastAccess(needsAccessUpdate);
            this.needsUpdate(true);
            return;
        }
        const needsExpiry = this.needsExpiry;
        if (needsExpiry.size) {
            this.needsExpiry = new Set();
            for (const cacheName of needsExpiry) {
                await this.removeExpiredIn(cacheName);
            }
        }
        if (nextUpdate !== this.nextUpdate) {
            this.needsUpdate(true);
        } else {
            this.nextUpdate = 0;
        }
    }

    async bumpLastAccess(needsAccessUpdate) {
        const cacheNames = [...needsAccessUpdate.keys()];
        await this.db.transaction(
            cacheNames,
            'readwrite',
            async (transaction) => {
                const now = Date.now();
                let last = null;
                for (const [cacheName, urls] of needsAccessUpdate) {
                    const store = transaction.objectStore(cacheName);
                    const existing = await Promise.all(
                        Array.from(urls, (url) => _(store.get(url))),
                    );
                    const rules = this.rules[cacheName];
                    const maxLastAccess = 1000 * (rules.maxLastAccess || 0);
                    const refetchIfOlderThan =
                        1000 * (rules.refetchIfOlderThan || 0);
                    let i = 0;
                    for (const record of existing) {
                        if (!record) {
                            continue;
                        }
                        if (
                            !maxLastAccess ||
                            record.lastAccess + maxLastAccess >= now
                        ) {
                            // Avoid identical lastAccess times so each entry
                            // is unique in the byLastAccess index
                            record.lastAccess = now + i;
                            last = store.put(record);
                            i += 1;
                        }
                        if (
                            refetchIfOlderThan &&
                            record.created + refetchIfOlderThan < now
                        ) {
                            this.fetchAndCacheIn(
                                cacheName,
                                new Request(record.url, {
                                    mode: 'cors',
                                    referrer: 'no-referrer',
                                }),
                                true,
                            );
                        }
                    }
                    if (maxLastAccess) {
                        this.needsExpiry.add(cacheName);
                    }
                }
                if (last) {
                    await _(last);
                }
            },
        );
    }

    async adjustMaxSize(cacheName, currentSize) {
        const rules = this.rules[cacheName];
        const maxSize = rules.maxSize || Infinity;
        const estimate = await navigator.storage?.estimate?.();
        const availableSize = estimate ? estimate.quota - estimate.usage : 0;
        if (
            availableSize &&
            availableSize + currentSize + 100_000_000 < maxSize
        ) {
            rules.maxSize = availableSize + currentSize;
            // Reduce the max size to give some headroom for other storage
            if (rules.maxSize > 500_000_000) {
                rules.maxSize -= 100_000_000;
            } else if (rules.maxSize > 50_000_000) {
                rules.maxSize -= 10_000_000;
            } else {
                rules.maxSize = 10_000_000;
            }
        }
    }

    async removeExpiredIn(cacheName) {
        const rules = this.rules[cacheName];
        const db = this.db;
        const maxLastAccess = rules.maxLastAccess;
        const maxNumber = rules.maxNumber || Infinity;
        const maxSize = rules.maxSize || Infinity;
        const entriesToDelete = [];
        let currentSize = 0;
        try {
            await db.transaction(cacheName, 'readonly', async (transaction) => {
                const store = transaction.objectStore(cacheName);
                const index = store.index('byLastUsed');
                const meta = await _(store.get(META_ID));
                let rangeStart = -1;
                let currentCount = meta.created;
                currentSize = meta.size;
                if (maxLastAccess) {
                    const entries = await _(
                        index.getAll(
                            IDBKeyRange.upperBound(
                                Date.now() - 1000 * maxLastAccess,
                                true,
                            ),
                        ),
                    );
                    for (const entry of entries) {
                        if (!entry.noExpire) {
                            entriesToDelete.push(entry);
                            currentSize -= entry.size;
                            currentCount -= 1;
                        }
                        rangeStart = entry.lastAccess;
                    }
                }
                if (currentCount > maxNumber) {
                    const entries = await _(
                        index.getAll(
                            IDBKeyRange.bound(rangeStart, Infinity, true, true),
                            currentCount - maxNumber,
                        ),
                    );
                    for (const entry of entries) {
                        if (!entry.noExpire) {
                            entriesToDelete.push(entry);
                            currentSize -= entry.size;
                            currentCount -= 1;
                        }
                        rangeStart = entry.lastAccess;
                    }
                }
                if (currentSize > maxSize) {
                    const entries = await _(
                        index.getAll(
                            IDBKeyRange.bound(rangeStart, Infinity, true, true),
                            128,
                        ),
                    );
                    for (const entry of entries) {
                        if (!entry.noExpire) {
                            entriesToDelete.push(entry);
                            currentSize -= entry.size;
                            currentCount -= 1;
                        }
                        if (currentSize <= maxSize) {
                            break;
                        }
                    }
                }
            });
            await this.adjustMaxSize(cacheName, currentSize);
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
                        // We check the lastAccess time has not changed so we
                        // don't delete an updated entry if setInCache has
                        // interleaved.
                        const [meta, entries] = await Promise.all([
                            _(store.get(META_ID)),
                            Promise.all(
                                entriesToDelete.map(({ url }) =>
                                    _(store.get(url)),
                                ),
                            ),
                        ]);
                        for (let i = 0, l = entries.length; i < l; i += 1) {
                            const entry = entries[i];
                            const entryToDelete = entriesToDelete[i];
                            if (
                                entry &&
                                entry.lastAccess === entryToDelete.lastAccess
                            ) {
                                store.delete(entry.url);
                                meta.size -= entry.size;
                                meta.created -= 1;
                            }
                        }
                        await _(store.put(meta));
                    },
                );
            }
        } catch (error) {
            console.log(error);
        }
    }
}

export { CacheManager };
