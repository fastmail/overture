/*
    Shared fixtures for the datastore test suite.

    These tests exercise the real datastore classes (no test framework or other
    package is imported — only node:test / node:assert and the Overture source
    itself). Two kinds of fixture are provided:

      makeStore()     - a real O.Store wired to a scriptable mock O.Source,
                        with a couple of O.Record types defined. Used for the
                        Store / LocalQuery / Record-lifecycle tests.

      makeMockStore() - a tiny object implementing just the handful of methods
                        O.WindowedQuery calls on its store (store-key mapping,
                        record lookup, status). Used for the windowed-query
                        tests, which never touch real records.
*/
import { Class } from '../../source/core/Core.js';
import { Obj } from '../../source/foundation/Object.js';
import * as RunLoop from '../../source/foundation/RunLoop.js';
import { Store } from '../../source/datastore/store/Store.js';
import { Source } from '../../source/datastore/source/Source.js';
import { AggregateSource } from '../../source/datastore/source/AggregateSource.js';
import { Record } from '../../source/datastore/record/Record.js';
import { attr } from '../../source/datastore/record/attr.js';
import { LocalQuery } from '../../source/datastore/query/LocalQuery.js';
import { WindowedQuery } from '../../source/datastore/query/WindowedQuery.js';
import * as Status from '../../source/datastore/record/Status.js';

export {
    Class,
    RunLoop,
    Store,
    Source,
    AggregateSource,
    Record,
    attr,
    LocalQuery,
    WindowedQuery,
    Status,
};

export const ACCOUNT_ID = 'acc1';

// --- Record types used across the suite -------------------------------------

export const Todo = Class({
    Name: 'Todo',
    Extends: Record,
    title: attr(String, { defaultValue: '' }),
    done: attr(Boolean, { defaultValue: false }),
    priority: attr(Number, { defaultValue: 0 }),
});

// --- A scriptable mock Source -----------------------------------------------
//
// Every method records the call in `source.calls` and, where it would normally
// hand off to the server, returns true (so the store treats it as handled).
// Tests then drive the response side directly via the store's sourceDid*
// callbacks.

export const MockSource = Class({
    Name: 'MockSource',
    Extends: Source,

    init: function (...mixins) {
        this.calls = [];
        MockSource.parent.constructor.apply(this, mixins);
    },

    fetchRecord(accountId, Type, id /*, callback */) {
        this.calls.push({ method: 'fetchRecord', accountId, Type, id });
        return true;
    },
    fetchAllRecords(accountId, Type, state, callback) {
        this.calls.push({
            method: 'fetchAllRecords',
            accountId,
            Type,
            state,
            callback,
        });
        return true;
    },
    fetchQuery(query /*, callback */) {
        this.calls.push({ method: 'fetchQuery', query });
        return true;
    },
    commitChanges(changes, callback) {
        this.calls.push({ method: 'commitChanges', changes, callback });
        return true;
    },

    callsTo(method) {
        return this.calls.filter((call) => call.method === method);
    },
});

/**
    Build a real Store backed by a MockSource, with a default account and the
    `Todo` type. Returns { store, source, flush } where flush() drains the run
    loop queues (the store defers change-detection and commits to the run loop).
*/
export function makeStore(mixin) {
    const source = new MockSource();
    const store = new Store({ source, autoCommit: false, ...mixin });
    // The default Store throws if asked to infer an account; for tests we just
    // route everything to the one account.
    store.getPrimaryAccountIdForType = () => ACCOUNT_ID;
    store.addAccount(ACCOUNT_ID, {});
    const flush = () => RunLoop.flushAllQueues();
    return { store, source, flush };
}

/**
    Seed the store with READY records of `Type` and mark the type fully loaded.
    `records` is an array of plain data objects (each must include an `id`).

    Note: this performs an `isAll` fetch, i.e. it declares `records` to be the
    complete set for the type. Calling it again replaces the previous set rather
    than adding to it — to grow the data, pass the full list each time.
*/
export function seedRecords(store, Type, records, state = 'state-0') {
    store.sourceDidFetchRecords(ACCOUNT_ID, Type, records, state, true);
    return records.map((data) => store.getStoreKey(ACCOUNT_ID, Type, data.id));
}

// --- Lightweight mock store for WindowedQuery tests -------------------------
//
// O.WindowedQuery only calls a small surface on its store: getStoreKey,
// getIdFromStoreKey, getRecordFromStoreKey, getStatus, hasChangesForType and
// observing isCommitting. This avoids standing up real records just to test
// list maintenance. Set `hasChanges` to control what hasChangesForType returns.

export function makeMockStore() {
    let nextStoreKey = 1;
    const idToStoreKey = new Map();
    const storeKeyToId = new Map();
    return new Obj({
        isCommitting: false,
        hasChanges: false,
        getStoreKey(accountId, Type, id) {
            if (!idToStoreKey.has(id)) {
                const storeKey = nextStoreKey;
                nextStoreKey += 1;
                idToStoreKey.set(id, storeKey);
                storeKeyToId.set(storeKey, id);
            }
            return idToStoreKey.get(id);
        },
        getIdFromStoreKey(storeKey) {
            return storeKeyToId.get(storeKey);
        },
        getRecordFromStoreKey(storeKey) {
            return { storeKey };
        },
        getStatus() {
            return Status.READY;
        },
        hasChangesForType() {
            return this.hasChanges;
        },
        addQuery() {},
        removeQuery() {},
        on() {
            return this;
        },
        off() {
            return this;
        },
        // exposed for assertions
        _idToStoreKey: idToStoreKey,
        _storeKeyToId: storeKeyToId,
    });
}

// A no-op Type constructor (WindowedQuery only needs an identity for guid()).
export function MockType() {}

/**
    Build a WindowedQuery over a lightweight mock store. Returns helpers that
    feed each kind of input the way a source would, plus the query itself.
*/
export function makeWindowedQuery(options = {}) {
    const store = makeMockStore();
    let fetchCount = 0;
    const source = {
        fetchQuery() {
            fetchCount += 1;
            return this;
        },
    };
    const query = new WindowedQuery({
        store,
        source,
        accountId: ACCOUNT_ID,
        Type: MockType,
        windowSize: options.windowSize ?? 30,
        where: options.where ?? null,
        sort: options.sort ?? null,
    });

    const sk = (id) => store.getStoreKey(ACCOUNT_ID, MockType, id);

    return {
        store,
        query,
        sk,
        fetchCount: () => fetchCount,
        ids(idList, position, queryState, total) {
            query.sourceDidFetchIds({
                accountId: ACCOUNT_ID,
                queryState,
                ids: idList,
                position,
                total,
                canCalculateChanges: true,
                isPartialResult: false,
                isOfflineSearch: false,
            });
        },
        clientRemove(removedIds) {
            query.clientDidGenerateUpdate({
                added: [],
                removed: removedIds.map(sk),
            });
        },
        clientAdd(added) {
            query.clientDidGenerateUpdate({
                added: added.map((a) => ({
                    index: a.index,
                    storeKey: sk(a.id),
                })),
                removed: [],
            });
        },
        sourceUpdate(oldQS, newQS, removedIds, added, total, upToId) {
            query.sourceDidFetchUpdate({
                accountId: ACCOUNT_ID,
                oldQueryState: oldQS,
                newQueryState: newQS,
                removed: removedIds,
                added,
                total,
                upToId,
            });
        },
        // Simulate the round trip that clears DIRTY/LOADING once a client
        // change has been committed to the server.
        commitRoundTrip() {
            const spec = query.sourceWillFetchQuery();
            if (spec && spec.callback) {
                spec.callback();
            }
        },
        idsAt(storeKeyList) {
            return storeKeyList.map((storeKey) =>
                store.getIdFromStoreKey(storeKey),
            );
        },
    };
}

/** Return the first duplicate store key in a list, or null if none. */
export function firstDuplicate(list) {
    const seen = new Set();
    for (let i = 0; i < list.length; i += 1) {
        const value = list[i];
        if (!value) {
            continue;
        }
        if (seen.has(value)) {
            return { index: i, storeKey: value };
        }
        seen.add(value);
    }
    return null;
}
