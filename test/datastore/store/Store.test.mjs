import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { guid } from '../../../source/core/Core.js';
import {
    ACCOUNT_ID,
    makeStore,
    seedRecords,
    Status,
    Todo,
} from '../helpers.mjs';

const { READY, DIRTY, NEW, DESTROYED, COMMITTING, EMPTY, NON_EXISTENT } =
    Status;

describe('Store: store keys and ids', () => {
    let store;
    beforeEach(() => {
        ({ store } = makeStore());
    });

    test('getStoreKey is stable for a given (type, id)', () => {
        const a = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        const b = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        assert.equal(a, b);
    });

    test('getStoreKey with no id returns a fresh key each time', () => {
        const a = store.getStoreKey(ACCOUNT_ID, Todo, undefined);
        const b = store.getStoreKey(ACCOUNT_ID, Todo, undefined);
        assert.notEqual(a, b);
    });

    test('distinct ids get distinct store keys', () => {
        const a = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        const b = store.getStoreKey(ACCOUNT_ID, Todo, 't2');
        assert.notEqual(a, b);
    });

    test('store key resolves back to id and account', () => {
        seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        const sk = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        assert.equal(store.getIdFromStoreKey(sk), 't1');
        assert.equal(store.getAccountIdFromStoreKey(sk), ACCOUNT_ID);
    });

    test('getStatus of an unknown store key is EMPTY', () => {
        assert.equal(store.getStatus(9999999), EMPTY);
    });
});

describe('Store: fetching records from the source', () => {
    let store;
    beforeEach(() => {
        ({ store } = makeStore());
    });

    test('sourceDidFetchRecords loads data and marks records READY', () => {
        seedRecords(store, Todo, [
            { id: 't1', title: 'one', done: false },
            { id: 't2', title: 'two', done: true },
        ]);
        const sk1 = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        assert.ok(store.getStatus(sk1) & READY);
        assert.equal(store.getData(sk1).title, 'one');

        const record = store.getRecord(ACCOUNT_ID, Todo, 't2');
        assert.equal(record.get('title'), 'two');
        assert.equal(record.get('done'), true);
    });

    test('isAll fetch marks the whole type READY', () => {
        assert.equal(store.getTypeStatus(ACCOUNT_ID, Todo) & READY, 0);
        seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        assert.ok(store.getTypeStatus(ACCOUNT_ID, Todo) & READY);
    });

    test('sourceDidFetchPartialRecords patches existing data', () => {
        seedRecords(store, Todo, [{ id: 't1', title: 'one', priority: 1 }]);
        store.sourceDidFetchPartialRecords(ACCOUNT_ID, Todo, {
            t1: { title: 'one-patched' },
        });
        const sk = store.getStoreKey(ACCOUNT_ID, Todo, 't1');
        assert.equal(store.getData(sk).title, 'one-patched');
        // unspecified fields are retained
        assert.equal(store.getData(sk).priority, 1);
    });

    test('sourceDidChangeIds remaps an id to a new id, keeping the store key', () => {
        seedRecords(store, Todo, [{ id: 'old', title: 'one' }]);
        const sk = store.getStoreKey(ACCOUNT_ID, Todo, 'old');
        store.sourceDidChangeIds(ACCOUNT_ID, Todo, { old: 'new' });
        assert.equal(store.getStoreKey(ACCOUNT_ID, Todo, 'new'), sk);
        assert.equal(store.getIdFromStoreKey(sk), 'new');
    });
});

describe('Store: in-memory data mutation', () => {
    let store;
    beforeEach(() => {
        ({ store } = makeStore());
    });

    test('updateData marks the record DIRTY when changeIsDirty', () => {
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        store.updateData(sk, { title: 'changed' }, true);
        assert.equal(store.getData(sk).title, 'changed');
        assert.ok(store.getStatus(sk) & DIRTY);
        // `hasChanges` (the boolean) is recomputed by a run-loop-deferred
        // checkForChanges; the per-type check is synchronous.
        assert.ok(store.hasChangesForType(Todo));
    });

    test('revertData restores the committed value and clears DIRTY', () => {
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        store.updateData(sk, { title: 'changed' }, true);
        store.revertData(sk);
        assert.equal(store.getData(sk).title, 'one');
        assert.equal(store.getStatus(sk) & DIRTY, 0);
    });
});

describe('Store: record lifecycle', () => {
    let store;
    let source;
    let flush;
    beforeEach(() => {
        ({ store, source, flush } = makeStore());
    });

    test('editing a record through its accessor sets DIRTY and queues a commit need', () => {
        seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        const record = store.getRecord(ACCOUNT_ID, Todo, 't1');
        record.set('title', 'edited');
        const sk = record.get('storeKey');
        assert.ok(store.getStatus(sk) & DIRTY);
        assert.equal(store.getData(sk).title, 'edited');
        assert.ok(store.hasChangesForType(Todo));
    });

    test('new record is NEW+DIRTY and is sent to the source on commit', () => {
        const record = new Todo(store);
        record.set('title', 'fresh');
        record.saveToStore();
        const sk = record.get('storeKey');
        assert.ok(store.getStatus(sk) & NEW);
        assert.ok(store.getStatus(sk) & DIRTY);

        store.commitChanges();
        flush();

        const commits = source.callsTo('commitChanges');
        assert.equal(commits.length, 1);
        assert.ok(store.getStatus(sk) & COMMITTING);
    });

    test('sourceDidCommitCreate assigns the server id and clears NEW', () => {
        const record = new Todo(store);
        record.set('title', 'fresh');
        record.saveToStore();
        const sk = record.get('storeKey');

        store.commitChanges();
        flush();
        store.sourceDidCommitCreate({ [sk]: { id: 'server-1' } });

        assert.equal(store.getIdFromStoreKey(sk), 'server-1');
        assert.equal(store.getStatus(sk) & NEW, 0);
        assert.ok(store.getStatus(sk) & READY);
    });

    test('destroyRecord moves the record to DESTROYED', () => {
        seedRecords(store, Todo, [{ id: 't1', title: 'one' }]);
        const record = store.getRecord(ACCOUNT_ID, Todo, 't1');
        record.destroy();
        flush();
        assert.ok(store.getStatus(record.get('storeKey')) & DESTROYED);
    });

    test('fetchAll asks the source to load the whole type', () => {
        store.fetchAll(ACCOUNT_ID, Todo, true);
        const fetches = source.callsTo('fetchAllRecords');
        assert.equal(fetches.length, 1);
        assert.equal(fetches[0].Type, Todo);
    });
});

describe('Store: queries', () => {
    test('findAll returns READY store keys, filtered and sorted', () => {
        const { store } = makeStore();
        seedRecords(store, Todo, [
            { id: 't1', title: 'banana', done: false },
            { id: 't2', title: 'apple', done: false },
            { id: 't3', title: 'cherry', done: true },
        ]);

        const notDone = store.findAll(
            Todo,
            (data) => !data.done,
            (a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0),
        );
        const titles = notDone.map((sk) => store.getData(sk).title);
        assert.deepEqual(titles, ['apple', 'banana']);
    });

    test('findOne returns the first matching store key or null', () => {
        const { store } = makeStore();
        seedRecords(store, Todo, [
            { id: 't1', title: 'one', done: false },
            { id: 't2', title: 'two', done: true },
        ]);
        const sk = store.findOne(Todo, (data) => data.done);
        assert.equal(store.getData(sk).title, 'two');
        assert.equal(
            store.findOne(Todo, (data) => data.title === 'nope'),
            null,
        );
    });
});

describe('Store: multiple accounts', () => {
    test('the same id in different accounts gets distinct, isolated store keys', () => {
        const { store } = makeStore();
        store.addAccount('acc2', {});

        const skA = store.getStoreKey('acc1', Todo, 'shared');
        const skB = store.getStoreKey('acc2', Todo, 'shared');
        assert.notEqual(skA, skB);
        assert.equal(store.getAccountIdFromStoreKey(skA), 'acc1');
        assert.equal(store.getAccountIdFromStoreKey(skB), 'acc2');
    });
});

describe('Store: source error and not-found handling', () => {
    test('sourceCouldNotFindRecords marks the record NON_EXISTENT', () => {
        const { store } = makeStore();
        const sk = store.getStoreKey(ACCOUNT_ID, Todo, 'ghost');
        store.fetchData(sk);
        store.sourceCouldNotFindRecords(ACCOUNT_ID, Todo, ['ghost']);
        assert.ok(store.getStatus(sk) & NON_EXISTENT);
    });

    test('a permanent create failure clears NEW and COMMITTING', () => {
        const { store, flush } = makeStore();
        const record = new Todo(store);
        record.set('title', 'doomed');
        record.saveToStore();
        const sk = record.get('storeKey');

        store.commitChanges();
        flush();
        assert.ok(store.getStatus(sk) & COMMITTING);

        store.sourceDidNotCreate([sk], true);
        assert.equal(store.getStatus(sk) & NEW, 0);
        assert.equal(store.getStatus(sk) & COMMITTING, 0);
    });
});

describe('Store: discarding and reverting changes', () => {
    test('discardChanges reverts every dirty record to its committed value', () => {
        const { store, flush } = makeStore();
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
        store.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'edited');
        assert.ok(store.getStatus(sk) & DIRTY);

        store.discardChanges();
        flush();
        assert.equal(store.getData(sk).title, 'orig');
        assert.equal(store.getStatus(sk) & DIRTY, 0);
    });

    test('destroying an uncommitted NEW record needs no server commit', () => {
        const { store, source, flush } = makeStore();
        const record = new Todo(store);
        record.set('title', 'temp');
        record.saveToStore();
        const sk = record.get('storeKey');
        assert.ok(store.getStatus(sk) & NEW);

        record.destroy();
        flush();
        // It never reached the server, so it is simply dropped (EMPTY), not
        // queued for a destroy commit.
        assert.equal(store.getStatus(sk), EMPTY);
        assert.equal(source.callsTo('commitChanges').length, 0);
    });
});

describe('Store: commit confirmation and server-driven updates', () => {
    test('sourceDidCommitUpdate returns the record to a clean READY state', () => {
        const { store, flush } = makeStore();
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
        store.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'new');

        store.commitChanges();
        flush();
        assert.ok(store.getStatus(sk) & COMMITTING);

        store.sourceDidCommitUpdate([sk]);
        assert.ok(store.getStatus(sk) & READY);
        assert.equal(store.getStatus(sk) & DIRTY, 0);
        assert.equal(store.getStatus(sk) & COMMITTING, 0);
    });

    test('a non-dirty (server-driven) updateData does not mark the record DIRTY', () => {
        const { store } = makeStore();
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
        store.updateData(sk, { title: 'from-server' }, false);
        assert.equal(store.getData(sk).title, 'from-server');
        assert.equal(store.getStatus(sk) & DIRTY, 0);
    });

    test('a fetch that lands mid-destroy invalidates cached attributes on rollback', () => {
        const { store, flush } = makeStore();
        const [sk] = seedRecords(store, Todo, [
            { id: 't1', title: 'orig', priority: 5 },
        ]);
        const record = store.getRecord(ACCOUNT_ID, Todo, 't1');
        // Populate the record's computed-property cache.
        assert.equal(record.get('priority'), 5);

        record.destroy();
        store.commitChanges();
        flush();
        assert.ok(store.getStatus(sk) & DESTROYED);
        assert.ok(store.getStatus(sk) & COMMITTING);

        // Attribute observers must stay quiet while the record is destroyed,
        // otherwise two-way bindings would write back to it.
        let priorityChanges = 0;
        record.addObserverForKey(
            'priority',
            {
                fire: () => {
                    priorityChanges += 1;
                },
            },
            'fire',
        );

        // The server returns the record without `priority` while the destroy
        // is still in flight, then the destroy fails and is rolled back.
        store.sourceDidFetchRecords(
            ACCOUNT_ID,
            Todo,
            [{ id: 't1', title: 'from-server' }],
            'state-1',
        );
        assert.equal(priorityChanges, 0);
        store.sourceDidNotDestroy([sk], true);
        assert.equal(priorityChanges, 1);

        assert.ok(store.getStatus(sk) & READY);
        assert.equal(record.get('title'), 'from-server');
        // Must fall back to the default, not the stale cached 5.
        assert.equal(record.get('priority'), 0);
    });
});

describe('Store: unloading records', () => {
    test('a clean record may be unloaded, a dirty one may not', () => {
        const { store } = makeStore();
        const [sk] = seedRecords(store, Todo, [{ id: 't1', title: 'orig' }]);
        assert.equal(store.mayUnloadRecord(sk), true);

        store.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'dirty');
        assert.equal(store.mayUnloadRecord(sk), false);
    });
});

describe('Store: server state changes during loads and commits', () => {
    let store;
    let source;
    let flush;
    let serverEvents;
    beforeEach(() => {
        ({ store, source, flush } = makeStore());
        seedRecords(store, Todo, [{ id: 't1', title: 'orig' }], 'state-0');
        serverEvents = 0;
        store.on(
            guid(Todo) + ':server:' + ACCOUNT_ID,
            {
                fire: () => {
                    serverEvents += 1;
                },
            },
            'fire',
        );
    });

    const startCommit = () => {
        store.getRecord(ACCOUNT_ID, Todo, 't1').set('title', 'edited');
        store.commitChanges();
        flush();
        const commits = source.callsTo('commitChanges');
        return commits[commits.length - 1].callback;
    };

    test('a push while loading still invalidates queries when the load reaches that state', () => {
        store.fetchAll(ACCOUNT_ID, Todo, true);
        const [{ callback: loadDone }] = source.callsTo('fetchAllRecords');

        store.sourceStateDidChange(ACCOUNT_ID, Todo, 'state-1');
        store.sourceDidFetchUpdates(
            ACCOUNT_ID,
            Todo,
            ['t1'],
            [],
            'state-0',
            'state-1',
        );
        loadDone();

        assert.ok(serverEvents > 0);
        assert.equal(source.callsTo('fetchAllRecords').length, 1);
    });

    test('a push while loading and committing still invalidates queries', () => {
        store.fetchAll(ACCOUNT_ID, Todo, true);
        const [{ callback: loadDone }] = source.callsTo('fetchAllRecords');
        const commitDone = startCommit();

        // Another client moves the server to state-1, which the in-flight load
        // picks up; our commit then takes it to state-2.
        store.sourceStateDidChange(ACCOUNT_ID, Todo, 'state-1');
        store.sourceDidFetchUpdates(
            ACCOUNT_ID,
            Todo,
            ['t1'],
            [],
            'state-0',
            'state-1',
        );
        loadDone();
        store.sourceCommitDidChangeState(
            ACCOUNT_ID,
            Todo,
            'state-1',
            'state-2',
        );
        commitDone();

        assert.ok(serverEvents > 0);
    });

    test('a push for our own commit arriving mid-commit is ignored', () => {
        const commitDone = startCommit();

        store.sourceStateDidChange(ACCOUNT_ID, Todo, 'state-1');
        store.sourceCommitDidChangeState(
            ACCOUNT_ID,
            Todo,
            'state-0',
            'state-1',
        );
        commitDone();

        assert.equal(serverEvents, 0);
        assert.equal(source.callsTo('fetchAllRecords').length, 0);
    });

    test('a push past our own commit arriving mid-commit fetches updates', () => {
        const commitDone = startCommit();

        store.sourceStateDidChange(ACCOUNT_ID, Todo, 'state-2');
        store.sourceCommitDidChangeState(
            ACCOUNT_ID,
            Todo,
            'state-0',
            'state-1',
        );
        commitDone();

        assert.ok(serverEvents > 0);
        const fetches = source.callsTo('fetchAllRecords');
        assert.equal(fetches.length, 1);
        assert.equal(fetches[0].state, 'state-1');
    });
});
