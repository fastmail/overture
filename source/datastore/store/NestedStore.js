import { Class, clone, isEqual } from '../../core/Core.js';
import { filter } from '../../core/KeyValue.js';
import { queueFn } from '../../foundation/RunLoop.js';
import {
    COMMITTING, // Request been made to source to commit record.
    DESTROYED,
    DIRTY, // Record has local changes not commited to source
    // Core states:
    EMPTY,
    // Properties
    LOADING, // Request made to source to fetch record or updates.
    NEW, // Record has not been committed to source.
    OBSOLETE, // Source may have changes not yet loaded.
    READY,
} from '../record/Status.js';
import { Store } from './Store.js';

// ---

// A Map with an optional parent: get() cascades up the chain, set/delete
// only affect this level. Replaces the Object.create(parent) pattern
// previously used for nested-store copy-on-write of _skToData/_skToStatus.
//
// Store never set()s undefined as a value, so a `value !== undefined` check
// is sufficient to distinguish "own has it" from "own doesn't have it".
class ChainedMap {
    constructor(parent) {
        this._own = new Map();
        this._parent = parent;
    }
    get(key) {
        const v = this._own.get(key);
        if (v !== undefined) {
            return v;
        }
        return this._parent.get(key);
    }
    set(key, value) {
        this._own.set(key, value);
        return this;
    }
    delete(key) {
        return this._own.delete(key);
    }
    ownHas(key) {
        return this._own.has(key);
    }
}

/**
    Class: O.NestedStore

    A Nested Store may be used to buffer changes before committing them to the
    parent store. The changes may be discarded instead of committing without
    ever affecting the parent store.
*/
const NestedStore = Class({
    Name: 'NestedStore',

    Extends: Store,

    autoCommit: false,
    isNested: true,

    /**
        Constructor: O.NestedStore

        Parameters:
            store - {O.Store} The parent store (this may be another nested
                    store).
    */
    init: function (store) {
        NestedStore.parent.constructor.call(this);

        // Shared properties with parent
        this._typeToSKToId = store._typeToSKToId;
        this._skToAccountId = store._skToAccountId;
        this._skToType = store._skToType;
        this._skToLastAccess = store._skToLastAccess;
        this._accounts = store._accounts;
        this._defaultAccountId = store._defaultAccountId;

        // Copy on write, layered on parent's status/data
        this._skToStatus = new ChainedMap(store._skToStatus);
        this._skToData = new ChainedMap(store._skToData);

        store.addNested(this);

        this._parentStore = store;
    },

    /**
        Method: O.NestedStore#destroy

        Removes the connection to the parent store so this store may be garbage
        collected.
    */
    destroy() {
        this._parentStore.removeNested(this);
        NestedStore.parent.destroy.call(this);
    },

    // === Client API ==========================================================

    /**
        Method: O.Store#commitChanges

        Commits any outstanding changes (created/updated/deleted records) to the
        parent store.

        Returns:
            {O.NestedStore} Returns self.
    */
    commitChanges() {
        this.fire('willCommit');
        const { _created, _destroyed, _skToData, _skToChanged, _skToType } =
            this;
        const parent = this._parentStore;

        for (const [storeKey, isCopyOfStoreKey] of _created) {
            if (isCopyOfStoreKey) {
                const data = _skToData.get(storeKey);
                parent.moveRecord(
                    isCopyOfStoreKey,
                    this.getAccountIdFromStoreKey(storeKey),
                    storeKey,
                );
                _skToData.delete(storeKey);
                parent.updateData(storeKey, data, true);
            } else {
                const data = _skToData.get(storeKey);
                const Type = _skToType.get(storeKey);
                parent.undestroyRecord(storeKey, Type, data);
            }
        }
        for (const [storeKey, changed] of _skToChanged) {
            const data = _skToData.get(storeKey);
            parent.updateData(storeKey, filter(data, changed), true);
        }
        for (const [storeKey, ifCopiedStoreKey] of _destroyed) {
            // Check if already handled by moveFromAccount in create.
            if (!ifCopiedStoreKey || !_created.has(ifCopiedStoreKey)) {
                parent.destroyRecord(storeKey);
            }
        }

        this._skToData = new ChainedMap(parent._skToData);
        this._skToStatus = new ChainedMap(parent._skToStatus);
        this._skToChanged = new Map();
        this._skToCommitted = new Map();
        this._created = new Map();
        this._destroyed = new Map();

        return this.set('hasChanges', false).fire('didCommit');
    },

    /**
        Method: O.Store#discardChanges

        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the same state as its parent.

        Returns:
            {O.NestedStore} Returns self.
    */
    discardChanges() {
        NestedStore.parent.discardChanges.call(this);

        const parent = this._parentStore;

        this._skToData = new ChainedMap(parent._skToData);
        this._skToStatus = new ChainedMap(parent._skToStatus);

        return this;
    },

    // === Low level (primarily internal) API: uses storeKey ===================

    getStatus(storeKey) {
        const status = this._skToStatus.get(storeKey) || EMPTY;
        return this._skToData.ownHas(storeKey) || status & DESTROYED
            ? status
            : status & ~(NEW | COMMITTING | DIRTY);
    },

    fetchAll(accountId, Type, force) {
        this._parentStore.fetchAll(accountId, Type, force);
        return this;
    },

    fetchData(storeKey) {
        this._parentStore.fetchData(storeKey);
        return this;
    },

    // === Notifications from parent store =====================================

    /**
        Method: O.NestedStore#parentDidChangeStatus

        Called by the parent store whenever it changes the status of a record.
        The nested store uses this to update its own status value for that
        record (if it has diverged from the parent) and to notify any O.Record
        instances belonging to it of the change.

        Parameters:
            storeKey  - {String} The store key for the record.
            oldStatus - {O.Status} The previous status value.
            newStatus - {O.Status} The new status value.
    */
    parentDidChangeStatus(storeKey, oldStatus, newStatus) {
        let previous = oldStatus & ~(NEW | COMMITTING | DIRTY);
        let status = newStatus & ~(NEW | COMMITTING | DIRTY);

        const _skToStatus = this._skToStatus;
        if (_skToStatus.ownHas(storeKey)) {
            previous = _skToStatus.get(storeKey);
            if (status & DESTROYED) {
                // Discard any dirty changes without firing change
                // notifications: observers should react to the DESTROYED
                // status change, not to attribute reverts. Notifying about
                // the reverts can cause two-way bindings to write back to
                // the now-destroyed record.
                if (previous & READY && previous & DIRTY) {
                    this._skToCommitted.delete(storeKey);
                    this._skToChanged.delete(storeKey);
                }
                // Reads will fall through to the parent store.
                this._skToData.delete(storeKey);
                _skToStatus.delete(storeKey);
            } else if (!(previous & NEW)) {
                // If NEW, parent status means it's been committed, which means
                // we're going to clear _skToStatus so we're already correct
                status = previous | (status & (OBSOLETE | LOADING));
                _skToStatus.set(storeKey, status);
            }
        }

        if (previous !== status) {
            // wasReady !== isReady
            if ((previous ^ status) & READY) {
                this._recordDidChange(storeKey);
            }
            const record = this._skToRecord.get(storeKey);
            if (record) {
                record.propertyDidChange('status', previous, status);
            }
            for (const nested of this._nestedStores) {
                nested.parentDidChangeStatus(storeKey, previous, status);
            }
        }
    },

    /**
        Method: O.NestedStore#parentDidSetData

        Called by the parent store when it sets the inital data for an empty
        record. The nested store can't have any changes as a nested store cannot
        load data independently of its parent, so all we need to do is notify
        any records.

        Parameters:
            storeKey    - {String} The store key for the record.
            changedKeys - {Object} A list of keys which have changed.
    */
    parentDidSetData(storeKey, changedKeys) {
        this._notifyRecordOfChanges(storeKey, changedKeys);
        for (const nested of this._nestedStores) {
            nested.parentDidSetData(storeKey, changedKeys);
        }
    },

    /**
        Method: O.NestedStore#parentDidUpdateData

        Called by the parent store whenever it makes a change to the data object
        for a record. The nested store uses this to update its own copy of the
        data object if it has diverged from that of the parent (either rebasing
        changes on top of the new parent state or discarding changes, depending
        on the value of <O.Store#rebaseConflicts>).

        Parameters:
            storeKey    - {String} The store key for the record.
            changedKeys - {Object} A list of keys which have changed.
    */
    parentDidUpdateData(storeKey, changedKeys) {
        const { _skToData, _skToChanged, _skToCommitted } = this;
        const oldChanged = _skToChanged.get(storeKey);
        if (oldChanged && _skToData.ownHas(storeKey)) {
            const parent = this._parentStore;
            const rebase = this.rebaseConflicts;
            const newBase = parent.getData(storeKey);
            const oldData = _skToData.get(storeKey);
            const newData = {};
            const newChanged = {};
            let clean = true;

            changedKeys = [];

            for (const key in oldData) {
                const isChanged = !isEqual(oldData[key], newBase[key]);
                if (rebase && key in oldChanged) {
                    if (isChanged) {
                        newChanged[key] = true;
                        clean = false;
                    }
                    newData[key] = oldData[key];
                } else {
                    if (isChanged) {
                        changedKeys.push(key);
                    }
                    newData[key] = newBase[key];
                }
            }
            if (!clean) {
                _skToChanged.set(storeKey, newChanged);
                _skToCommitted.set(storeKey, clone(newBase));
                this.setData(storeKey, newData);
                return;
            }
            this.setStatus(
                storeKey,
                parent.getStatus(storeKey) & ~(NEW | COMMITTING | DIRTY),
            );
            _skToData.delete(storeKey);
            _skToChanged.delete(storeKey);
            _skToCommitted.delete(storeKey);
            this._skToStatus.delete(storeKey);
        }
        this._notifyRecordOfChanges(storeKey, changedKeys);
        for (const nested of this._nestedStores) {
            nested.parentDidUpdateData(storeKey, changedKeys);
        }
        this._recordDidChange(storeKey);
        queueFn('before', this.checkForChanges, this);
    },

    // === A nested store is not directly connected to a source ================

    sourceStateDidChange: null,

    sourceDidFetchRecords: null,
    sourceDidFetchPartialRecords: null,
    sourceCouldNotFindRecords: null,

    sourceDidFetchUpdates: null,
    sourceDidModifyRecords: null,
    sourceDidDestroyRecords: null,

    sourceCommitDidChangeState: null,

    sourceDidCommitCreate: null,
    sourceDidNotCreate: null,
    sourceDidCommitUpdate: null,
    sourceDidNotUpdate: null,
    sourceDidCommitDestroy: null,
    sourceDidNotDestroy: null,
});

export { NestedStore };
