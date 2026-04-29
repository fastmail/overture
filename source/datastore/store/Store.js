import { Class, clone, guid, isEqual, meta } from '../../core/Core.js';
import { filter as filterObject, keyOf } from '../../core/KeyValue.js';
import { Event } from '../../foundation/Event.js';
import { EventTarget } from '../../foundation/EventTarget.js';
import { Obj } from '../../foundation/Object.js';
import { didError, queueFn } from '../../foundation/RunLoop.js';
import { RecordArray } from '../query/RecordArray.js';
import { Record } from '../record/Record.js';
import {
    COMMITTING, // Request in progress to commit record
    DESTROYED,
    DIRTY, // Record has local changes not yet committing
    // Core states:
    EMPTY,
    // Properties:
    LOADING, // Request in progress to fetch record or updates
    NEW, // Record is not created on source (has no source id)
    NON_EXISTENT,
    OBSOLETE, // Record may have changes not yet loaded
    READY,
} from '../record/Status.js';
// eslint-disable-next-line import/no-namespace
import * as Status from '../record/Status.js';
import { ToManyAttribute } from '../record/toMany.js';
import { ToOneAttribute } from '../record/toOne.js';

/**
    Module: DataStore

    The DataStore module provides classes for managing the CRUD lifecycle of
    data records.
*/

// ---

// Error messages.
const CANNOT_CREATE_EXISTING_RECORD_ERROR =
    'O.Store Error: Cannot create existing record';
const CANNOT_WRITE_TO_UNREADY_RECORD_ERROR =
    'O.Store Error: Cannot write to unready record';
const SOURCE_COMMIT_CREATE_MISMATCH_ERROR =
    'O.Store Error: Source committed a create on a record not marked new';
const SOURCE_COMMIT_DESTROY_MISMATCH_ERROR =
    'O.Store Error: Source commited a destroy on a record not marked destroyed';

// ---

// Store keys are small integers, kept as V8 SMIs / Uint32s. Cheaper than
// strings as object identity, and faster as Map keys. Generation starts at
// 1 so that 0 can serve as a "no copy" sentinel in _created/_destroyed.
let nextStoreKey = 1;
const generateStoreKey = function () {
    const current = nextStoreKey;
    nextStoreKey += 1;
    return current;
};

// ---

const mayHaveChanges = function (store) {
    queueFn('before', store.checkForChanges, store);
    return store;
};

// ---

const acceptStoreKey = function (accept, storeKey) {
    return accept(this._skToData.get(storeKey), this, storeKey);
};

const compareStoreKeys = function (compare, a, b) {
    const { _skToData } = this;
    const aIsFirst = compare(_skToData.get(a), _skToData.get(b), this, a, b);
    return aIsFirst || a - b;
};

// ---

const STRING_ID = 0;
const ARRAY_IDS = 1;
const SET_IDS = 2;

const typeToForeignRefAttrs = new WeakMap();

const getForeignRefAttrs = function (Type) {
    let foreignRefAttrs = typeToForeignRefAttrs.get(Type);
    if (!foreignRefAttrs) {
        const proto = Type.prototype;
        const attrs = meta(proto).attrs;
        foreignRefAttrs = [];
        for (const attrKey in attrs) {
            const propKey = attrs[attrKey];
            const attribute = propKey && proto[propKey];
            if (attribute instanceof ToOneAttribute) {
                foreignRefAttrs.push([attrKey, STRING_ID, attribute.Type]);
            }
            if (attribute instanceof ToManyAttribute) {
                foreignRefAttrs.push([
                    attrKey,
                    attribute.Type === Object ? SET_IDS : ARRAY_IDS,
                    attribute.recordType,
                ]);
            }
        }
        typeToForeignRefAttrs.set(Type, foreignRefAttrs);
    }
    return foreignRefAttrs;
};

const convertForeignKeysToSK = function (
    store,
    foreignRefAttrs,
    data,
    accountId,
) {
    const l = foreignRefAttrs.length;
    for (let i = 0; i < l; i += 1) {
        const foreignRef = foreignRefAttrs[i];
        const attrKey = foreignRef[0];
        const AttrType = foreignRef[2];
        const idType = foreignRef[1];
        if (attrKey in data) {
            const value = data[attrKey];
            if (!value) {
                data[attrKey] = value;
            } else if (idType === STRING_ID) {
                data[attrKey] = store.getStoreKey(accountId, AttrType, value);
            } else if (idType === ARRAY_IDS) {
                const len = value.length;
                const arr = new Array(len);
                for (let k = 0; k < len; k += 1) {
                    arr[k] = store.getStoreKey(accountId, AttrType, value[k]);
                }
                data[attrKey] = arr;
            } else {
                // idType === SET_IDS
                const obj = {};
                for (const id in value) {
                    obj[store.getStoreKey(accountId, AttrType, id)] = value[id];
                }
                data[attrKey] = obj;
            }
        }
    }
};

const toId = function (store, storeKey) {
    return store.getIdFromStoreKey(storeKey) || '#' + storeKey;
};

const convertForeignKeysToId = function (store, Type, data) {
    const foreignRefAttrs = getForeignRefAttrs(Type);
    let result = data;
    const l = foreignRefAttrs.length;
    for (let i = 0; i < l; i += 1) {
        const foreignRef = foreignRefAttrs[i];
        const attrKey = foreignRef[0];
        const idType = foreignRef[1];
        if (attrKey in data) {
            if (result === data) {
                result = clone(data);
            }
            const value = data[attrKey];
            if (!value) {
                result[attrKey] = value;
            } else if (idType === STRING_ID) {
                result[attrKey] = toId(store, value);
            } else if (idType === ARRAY_IDS) {
                const len = value.length;
                const arr = new Array(len);
                for (let k = 0; k < len; k += 1) {
                    arr[k] = toId(store, value[k]);
                }
                result[attrKey] = arr;
            } else {
                // idType === SET_IDS. Keys are storeKeys (numeric); JS
                // object keys are strings, so coerce back before resolving.
                const obj = {};
                for (const sk in value) {
                    obj[toId(store, +sk)] = value[sk];
                }
                result[attrKey] = obj;
            }
        }
    }
    return result;
};

// ---

const getChanged = function (Type, a, b) {
    const changed = {};
    const clientSettable = Record.getClientSettableAttributes(Type);
    let hasChanges = false;
    for (const key in a) {
        if (clientSettable[key] && !isEqual(a[key], b[key])) {
            changed[key] = true;
            hasChanges = true;
        }
    }
    return hasChanges ? changed : null;
};

const getDelta = function (Type, data, changed) {
    const proto = Type.prototype;
    const attrs = meta(proto).attrs;
    const delta = {};
    for (const attrKey in changed) {
        if (changed[attrKey]) {
            let value = data[attrKey];
            if (value === undefined) {
                value = proto[attrs[attrKey]].defaultValue;
            }
            delta[attrKey] = value;
        }
    }
    return delta;
};

// ---

/**
    Class: O.Store

    A Store is used to keep track of all records in the model. It provides
    methods for retrieving single records or lists based on queries.

    Principles:
    * Records are never locked: you can always edit or destroy a READY record,
      even when it is committing another change.
    * A record never has more than one change in flight to the server at once.
      If it is currently committing, any further change must wait for the
      previous commit to succeed/fail before being committed to the server.
    * A record is always in exactly one of the core states:
      - `EMPTY`: No information is known about the record.
      - `READY`: The record is loaded in memory. You may read, update or
        destroy it.
      - `DESTROYED`: The record has been destroyed. (This may not have been
        committed to the server yet; see below).
      - `NON_EXISTENT`: No record with the requested id exists.
    * A record may additionally have one or more of the following status bits
      set:
      - `LOADING`: A request is in progress to fetch the record's data
        (or update the data if the record is already in memory).
      - `COMMITTING`: A request is in progress to commit a change to the record.
      - `NEW`: The record is not yet created on the source (and therefore has
         no source id).
      - `DIRTY`: The record has local changes not yet committing.
      - `OBSOLETE`: The record may have changes on the server not yet loaded.
*/
const Store = Class({
    Name: 'Store',

    Extends: Obj,

    /**
        Property: O.Store#autoCommit
        Type: Boolean
        Default: true

        If true, the store will automatically commit any changes at the end of
        the RunLoop in which they are made.
    */
    autoCommit: true,

    /**
        Property: O.Store#rebaseConflicts
        Type: Boolean
        Default: true

        If true, in the event that new data is loaded for a dirty record, the
        store will apply the changes made to the previous committed state on top
        of the current committed state, rather than just discarding the changes.
    */
    rebaseConflicts: true,

    /**
        Property: O.Store#isNested
        Type: Boolean

        Is this a nested store?
    */
    isNested: false,

    /**
        Property: O.Store#hasChanges
        Type: Boolean

        Are there any changes in the store?
    */

    /**
        Constructor: O.Store

        Parameters:
            ...mixins - {Object} Objects to mix in, which must include a
                        parameter named `source` of type {O.Source}, the source
                        for this store.
    */
    init: function (/* ...mixins */) {
        // Type -> Map store key -> id
        this._typeToSKToId = new Map();
        // store key -> accountId
        this._skToAccountId = new Map();
        // store key -> Type
        this._skToType = new Map();
        // store key -> status. NestedStore wraps this in a ChainedMap.
        this._skToStatus = new Map();
        // store key -> data. NestedStore wraps this in a ChainedMap.
        this._skToData = new Map();
        // store key -> object with `true` for each changed property
        this._skToChanged = new Map();
        // store key -> last committed data (when changed)
        this._skToCommitted = new Map();
        // store key -> last committed data (when committing)
        this._skToRollback = new Map();
        // store key -> record
        this._skToRecord = new Map();
        // store key -> last access timestamp for memory manager
        this._skToLastAccess = new Map();

        // Any changes waiting to be committed?
        this.hasChanges = false;
        // Flag if committing
        this.isCommitting = false;
        // store key -> isCopyOfStoreKey ('' if none)
        this._created = new Map();
        // store key -> ifCopiedStoreKey ('' if none)
        this._destroyed = new Map();

        // id -> query
        this._idToQuery = new Map();
        // Types that have had data changed during this run loop
        this._changedTypes = new Set();

        // Set of nested stores
        this._nestedStores = new Set();

        // accountId -> { status, clientState, serverState, ... }
        // (An account MUST be added before attempting to use the store.)
        this._accounts = new Map();

        Store.parent.constructor.apply(this, arguments);

        if (!this.get('isNested')) {
            this.source.set('store', this);
        }
    },

    // === Nested Stores =======================================================

    /**
        Method: O.Store#addNested

        Registers a new nested store. Automatically called by the
        <O.NestedStore> constructor; there should be no need to do it manually.

        Parameters:
            store - {O.NestedStore} The new nested store.

        Returns:
            {O.Store} Returns self.
    */
    addNested(store) {
        this._nestedStores.add(store);
        return this;
    },

    /**
        Method: O.Store#removeNested

        Deregisters a nested store previously registered with addNested.
        Automatically called by <O.NestedStore#destroy>; there should be no need
        to call this method manually.

        Parameters:
            store - {O.NestedStore} The nested store to deregister.

        Returns:
            {O.Store} Returns self.

    */
    removeNested(store) {
        this._nestedStores.delete(store);
        return this;
    },

    // === Accounts ============================================================

    /**
        Method: O.Store#getPrimaryAccountIdForType

        Get the default account ID for the specified type.

        The default implementation of this method basically doesn’t support the
        concept of a default accountId; accountId must always be specified, or
        this method will be called and throw a TypeError. This method is
        designed to be overridden, straight on the O.Store prototype. (Yes,
        that’s nasty. Sorry; c’est la vie.)

        Parameters:
            Type - {class extending O.Record}

        Returns:
            {string} Returns the primary accountId for data of that type.
    */
    getPrimaryAccountIdForType(/* Type */) {
        throw new TypeError('accountId cannot be inferred');
    },

    /**
        Method: O.Store#getAccount

        Get the account for the given account ID, or if it is not specified, the
        primary account for the given type.

        Parameters:
            accountId - {(string|undefined|null)}
            Type - {(class extending O.Record|undefined)}

        Returns:
            {(Object|undefined)} Returns the account data, or undefined if
                                 there’s not enough to go by or the details
                                 given don’t resolve to an account.
    */
    getAccount(accountId, Type) {
        if (!accountId) {
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        return this._accounts.get(accountId);
    },

    addAccount(accountId, data) {
        const _accounts = this._accounts;
        // replaceAccountId is intended for situations where you wish to
        // retrieve a record that should be broadly considered a global, before
        // you have loaded the accounts. This way, you can add a dummy account,
        // get those records from the dummy account, and then when you have the
        // accounts, silently update the accountId to the real value. That way
        // you can still handle all of your bindings declaratively, rather than
        // having to wait until you have loaded the accounts.
        const replaceAccountId = data.replaceAccountId;
        let account;
        if (replaceAccountId && (account = _accounts.get(replaceAccountId))) {
            if (data.accountCapabilities) {
                account.accountCapabilities = data.accountCapabilities;
            }
            const skToAccountId = this._skToAccountId;
            for (const [sk, id] of skToAccountId) {
                if (id === replaceAccountId) {
                    skToAccountId.set(sk, accountId);
                }
            }
            _accounts.delete(replaceAccountId);
        } else if (!(account = _accounts.get(accountId))) {
            account = {
                accountCapabilities: data.accountCapabilities,
                // Type -> status
                // READY      - Some records of type loaded
                // LOADING    - Loading or refreshing ALL records of type
                // COMMITTING - Committing some records of type
                status: new Map(),
                // Type -> Promise. Resolved (and cleared) when
                // type becomes READY.
                awaitingReadyPromise: new Map(),
                // Type -> Function (promise resolver). Called when
                // type becomes READY.
                awaitingReadyResolve: new Map(),
                // Type -> state string for type in client
                clientState: new Map(),
                // Type -> latest known state string for type on server
                // If committing or loading type, wait until finish to check
                serverState: new Map(),
                // Type -> Map id -> store key
                typeToIdToSK: new Map(),
                // Clients can set this to true while doing a batch of changes
                // to avoid fetching updates to related types during the process
                ignoreServerState: false,
            };
        }
        _accounts.set(accountId, account);

        return this;
    },

    // === Get/set Ids =========================================================

    /**
        Method: O.Store#getStoreKey

        Returns the store key for a particular record type and record id. This
        is guaranteed to be the same for that tuple until the record is unloaded
        from the store. If no id is supplied, a new store key is always
        returned.

        Parameters:
            accountId - {String|null} The account to use, or null for default.
            Type      - {O.Class} The constructor for the record type.
            id        - {String} (optional) The id of the record.

        Returns:
            {String} Returns the store key for that record type and id.
    */
    getStoreKey(accountId, Type, id) {
        if (!accountId) {
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        const account = this._accounts.get(accountId);
        const typeToIdToSK = account.typeToIdToSK;
        let idToSk = typeToIdToSK.get(Type);
        if (!idToSk) {
            idToSk = new Map();
            typeToIdToSK.set(Type, idToSk);
        }
        let storeKey;

        if (id) {
            storeKey = idToSk.get(id);
        }
        if (!storeKey) {
            storeKey = generateStoreKey();
            this._skToType.set(storeKey, Type);
            this._skToAccountId.set(storeKey, accountId);
            const { _typeToSKToId } = this;
            let skToId = _typeToSKToId.get(Type);
            if (!skToId) {
                skToId = new Map();
                _typeToSKToId.set(Type, skToId);
            }
            skToId.set(storeKey, id);
            if (id) {
                idToSk.set(id, storeKey);
            }
        }

        return storeKey;
    },

    /**
        Method: O.Store#getIdFromStoreKey

        Get the record id for a given store key.

        Parameters:
            storeKey - {String} The store key to get the record id for.

        Returns:
            {(String|null)} Returns the id for the record, or null if the store
            key was not found or does not have an id (normally because the
            server assigns ids and the record has not yet been committed).
    */
    getIdFromStoreKey(storeKey) {
        const status = this._skToStatus.get(storeKey);
        const Type = this._skToType.get(storeKey);
        const skToId = this._typeToSKToId.get(Type);
        return (!(status & NEW) && skToId && skToId.get(storeKey)) || null;
    },

    /**
        Method: O.Store#getAccountIdFromStoreKey

        Get the account id for a given store key.

        Parameters:
            storeKey - {String} The store key to get the account id for.

        Returns:
            {(String)} Returns the id of the account the record belongs to.
    */
    getAccountIdFromStoreKey(storeKey) {
        const data = this._skToData.get(storeKey);
        return data ? data.accountId : this._skToAccountId.get(storeKey);
    },

    // === Client API ==========================================================

    /**
        Method: O.Store#getRecordStatus

        Returns the status value for a given record type and id.

        Parameters:
            accountId - {String|null} The account id.
            Type      - {O.Class} The record type.
            id        - {String} The record id.

        Returns:
            {O.Status} The status in this store of the given record.
    */
    getRecordStatus(accountId, Type, id) {
        const idToSk = this.getAccount(accountId, Type).typeToIdToSK.get(Type);
        return idToSk ? this.getStatus(idToSk.get(id)) : EMPTY;
    },

    /**
        Method: O.Store#getRecord

        Returns a record object for a particular type and id, creating it if it
        does not already exist and fetching its value if not already loaded in
        memory, unless the doNotFetch parameter is set.

        Parameters:
            accountId  - {String|null} The account id.
            Type       - {O.Class} The record type.
            id         - {String} The record id, or the store key prefixed with
                         a '#'.
            doNotFetch - {Boolean} (optional) If true, the record data will not
                         be fetched from the server if it is not already loaded.

        Returns:
            {O.Record|null} Returns the requested record, or null if no type or
            no id given.
    */
    getRecord(accountId, Type, id, doNotFetch) {
        let storeKey;
        if (!Type || !id) {
            return null;
        }
        if (id.charAt(0) === '#') {
            storeKey = +id.slice(1);
            if (this._skToType.get(storeKey) !== Type) {
                return null;
            }
        } else {
            storeKey = this.getStoreKey(accountId, Type, id);
        }
        return this.getRecordFromStoreKey(storeKey, doNotFetch);
    },

    /**
        Method: O.Store#getOne

        Returns the first loaded record that matches an acceptance function.

        Parameters:
            Type   - {O.Class} The constructor for the record type to find.
            filter - {Function} (optional) An acceptance function. This will be
                     passed the raw data object (*not* a record instance) and
                     should return true if the record is the desired one, or
                     false otherwise.

        Returns:
            {(O.Record|null)} The matching record, or null if none found.
    */
    getOne(Type, filter) {
        const storeKey = this.findOne(Type, filter);
        return storeKey ? this.materialiseRecord(storeKey) : null;
    },

    /**
        Method: O.Store#getAll

        Returns a record array of records with data loaded for a particular
        type, optionally filtered and/or sorted.

        Parameters:
            Type   - {O.Class} The constructor for the record type being
                     queried.
            filter - {Function} (optional) An acceptance function. This will be
                     passed the raw data object (*not* a record instance) and
                     should return true if the record should be included, or
                     false otherwise.
            sort   - {Function} (optional) A comparator function. This will be
                     passed the raw data objects (*not* record instances) for
                     two records. It should return -1 if the first record should
                     come before the second, 1 if the inverse is true, or 0 if
                     they should have the same position.

        Returns:
            {O.RecordArray} A record array of results.
    */
    getAll(Type, filter, sort) {
        const storeKeys = this.findAll(Type, filter, sort);
        return new RecordArray(this, Type, storeKeys);
    },

    checkForChanges() {
        return this.set(
            'hasChanges',
            this._created.size > 0 ||
                this._skToChanged.size > 0 ||
                this._destroyed.size > 0,
        );
    },

    hasChangesForType(Type) {
        const { _created, _destroyed, _skToChanged, _skToType } = this;
        for (const storeKey of _created.keys()) {
            if (Type === _skToType.get(storeKey)) {
                return true;
            }
        }
        for (const storeKey of _skToChanged.keys()) {
            if (Type === _skToType.get(storeKey)) {
                return true;
            }
        }
        for (const storeKey of _destroyed.keys()) {
            if (Type === _skToType.get(storeKey)) {
                return true;
            }
        }
        return false;
    },

    /**
        Method: O.Store#commitChanges

        Commits any outstanding changes (created/updated/deleted records) to the
        source. Will only invoke once per run loop, even if called multiple
        times.

        Returns:
            {O.Store} Returns self.
    */
    commitChanges: function () {
        // Don't commit if another commit is already in progress. We can't
        // reference a foreign ID if it is currently being created in an
        // inflight request. We also need the new state string for commits
        // to a particular type to make sure we don't miss any changes.
        // We'll automatically commit again if there are any changes when the
        // current commit finishes.
        if (this.get('isCommitting')) {
            return;
        }
        this.set('isCommitting', true);

        this.fire('willCommit');
        const {
            _typeToSKToId,
            _skToData,
            _skToStatus,
            _skToType,
            _skToChanged,
            _skToCommitted,
            _skToRollback,
            _created,
            _destroyed,
            _accounts,
        } = this;

        // The contract with Source is a plain object dict; key is opaque.
        const changes = {};
        let hasChanges = false;

        const getEntry = function (Type, accountId) {
            const typeId = guid(Type);
            const compositeKey = typeId + '\0' + accountId;
            let entry = changes[compositeKey];
            if (!entry) {
                const account = _accounts.get(accountId);
                const idPropKey = Type.primaryKey || 'id';
                const idAttrKey = Type.prototype[idPropKey].key || idPropKey;
                entry = changes[compositeKey] = {
                    Type,
                    typeId,
                    accountId,
                    primaryKey: idAttrKey,
                    create: { storeKeys: [], records: [] },
                    update: {
                        storeKeys: [],
                        records: [],
                        committed: [],
                        changes: [],
                    },
                    moveFromAccount: {},
                    destroy: { storeKeys: [], ids: [] },
                    state: account.clientState.get(Type),
                };
                account.status.set(
                    Type,
                    (account.status.get(Type) || 0) | COMMITTING,
                );
                hasChanges = true;
            }
            return entry;
        };

        for (const [storeKey, isCopyOfStoreKey] of _created) {
            const status = _skToStatus.get(storeKey);
            const Type = _skToType.get(storeKey);
            let data = _skToData.get(storeKey);
            const accountId = data.accountId;
            const entry = getEntry(Type, accountId);
            let create;

            if (isCopyOfStoreKey) {
                const changed = getChanged(
                    Type,
                    data,
                    _skToData.get(isCopyOfStoreKey),
                );
                data = convertForeignKeysToId(this, Type, data);
                const previousAccountId =
                    this.getAccountIdFromStoreKey(isCopyOfStoreKey);
                create =
                    entry.moveFromAccount[previousAccountId] ||
                    (entry.moveFromAccount[previousAccountId] = {
                        copyFromIds: [],
                        storeKeys: [],
                        records: [],
                        changes: [],
                    });
                create.copyFromIds.push(
                    this.getIdFromStoreKey(isCopyOfStoreKey),
                );
                create.changes.push(changed);
            } else {
                data = filterObject(
                    convertForeignKeysToId(this, Type, data),
                    Record.getClientSettableAttributes(Type),
                );
                create = entry.create;
            }

            create.storeKeys.push(storeKey);
            create.records.push(data);
            this.setStatus(storeKey, (status & ~DIRTY) | COMMITTING);
        }
        for (const [storeKey, changedRaw] of _skToChanged) {
            const status = _skToStatus.get(storeKey);
            const Type = _skToType.get(storeKey);
            const changed = filterObject(
                changedRaw,
                Record.getClientSettableAttributes(Type),
            );

            let previous = _skToCommitted.get(storeKey);
            _skToCommitted.delete(storeKey);
            // If all updates for a record are to noSync attributes, don't
            // commit update to source
            if (!Object.keys(changed).length) {
                this.setStatus(storeKey, status & ~DIRTY);
                continue;
            }
            let data = _skToData.get(storeKey);
            const accountId = data.accountId;
            const update = getEntry(Type, accountId).update;

            _skToRollback.set(storeKey, previous);
            previous = convertForeignKeysToId(this, Type, previous);
            data = convertForeignKeysToId(this, Type, data);

            update.storeKeys.push(storeKey);
            update.records.push(data);
            update.committed.push(previous);
            update.changes.push(changed);
            this.setStatus(storeKey, (status & ~DIRTY) | COMMITTING);
        }
        for (const [storeKey, ifCopiedStoreKey] of _destroyed) {
            const status = _skToStatus.get(storeKey);
            // Check if already handled by moveFromAccount in create.
            if (!ifCopiedStoreKey || !_created.has(ifCopiedStoreKey)) {
                const Type = _skToType.get(storeKey);
                const accountId = _skToData.get(storeKey).accountId;
                const id = _typeToSKToId.get(Type).get(storeKey);
                const destroy = getEntry(Type, accountId).destroy;

                destroy.storeKeys.push(storeKey);
                destroy.ids.push(id);
            }
            this.setStatus(storeKey, (status & ~DIRTY) | COMMITTING);
        }

        this._skToChanged = new Map();
        this._created = new Map();
        this._destroyed = new Map();

        if (hasChanges) {
            this.source.commitChanges(changes, () => {
                for (const id in changes) {
                    const entry = changes[id];
                    const Type = entry.Type;
                    const accountId = entry.accountId;
                    const account = _accounts.get(accountId);
                    account.status.set(
                        Type,
                        account.status.get(Type) & ~COMMITTING,
                    );
                    this.checkServerState(accountId, Type);
                }
                this.set('isCommitting', false);
                if (
                    this.get('autoCommit') &&
                    this.checkForChanges().get('hasChanges')
                ) {
                    this.commitChanges();
                }
            });
        } else {
            this.set('isCommitting', false);
        }

        this.set('hasChanges', false);
        this.fire('didCommit');
    }.queue('middle'),

    /**
        Method: O.Store#discardChanges

        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the last known committed state.

        Returns:
            {O.Store} Returns self.
    */
    discardChanges() {
        const {
            _created,
            _destroyed,
            _skToChanged,
            _skToCommitted,
            _skToType,
            _skToData,
        } = this;

        for (const storeKey of _created.keys()) {
            this.destroyRecord(storeKey);
        }
        for (const storeKey of _skToChanged.keys()) {
            this.updateData(storeKey, _skToCommitted.get(storeKey), true);
        }
        for (const storeKey of _destroyed.keys()) {
            this.undestroyRecord(
                storeKey,
                _skToType.get(storeKey),
                _skToData.get(storeKey),
            );
        }

        this._created = new Map();
        this._destroyed = new Map();

        return this.set('hasChanges', false);
    },

    getInverseChanges() {
        const {
            _created,
            _destroyed,
            _skToType,
            _skToData,
            _skToChanged,
            _skToCommitted,
        } = this;
        const inverse = {
            create: [],
            update: [],
            destroy: [],
            move: [],
        };

        for (const [storeKey, previousStoreKey] of _created) {
            if (!previousStoreKey) {
                inverse.destroy.push(storeKey);
            } else {
                inverse.move.push([
                    storeKey,
                    this.getAccountIdFromStoreKey(previousStoreKey),
                    previousStoreKey,
                ]);
                inverse.update.push([
                    previousStoreKey,
                    getDelta(
                        _skToType.get(storeKey),
                        _skToData.get(previousStoreKey),
                        getChanged(
                            _skToType.get(storeKey),
                            _skToData.get(previousStoreKey),
                            _skToData.get(storeKey),
                        ),
                    ),
                ]);
            }
        }
        for (const [storeKey, changed] of _skToChanged) {
            const committed = _skToCommitted.get(storeKey);
            const Type = _skToType.get(storeKey);
            const update = getDelta(Type, committed, changed);
            inverse.update.push([storeKey, update]);
        }
        for (const [storeKey, ifCopied] of _destroyed) {
            if (!ifCopied) {
                const Type = _skToType.get(storeKey);
                inverse.create.push([
                    storeKey,
                    Type,
                    clone(_skToData.get(storeKey)),
                ]);
            }
        }

        return inverse;
    },

    applyChanges(changes) {
        const create = changes.create;
        const update = changes.update;
        const destroy = changes.destroy;
        const move = changes.move;

        for (let i = 0, l = create.length; i < l; i += 1) {
            const createObj = create[i];
            const storeKey = createObj[0];
            const Type = createObj[1];
            const data = createObj[2];
            this.undestroyRecord(storeKey, Type, data);
        }
        for (let i = 0, l = move.length; i < l; i += 1) {
            const moveObj = move[i];
            const storeKey = moveObj[0];
            const toAccountId = moveObj[1];
            const previousStoreKey = moveObj[2];
            this.moveRecord(storeKey, toAccountId, previousStoreKey);
        }
        for (let i = 0, l = update.length; i < l; i += 1) {
            const updateObj = update[i];
            const storeKey = updateObj[0];
            const data = updateObj[1];
            this.updateData(storeKey, data, true);
        }
        for (let i = 0, l = destroy.length; i < l; i += 1) {
            const storeKey = destroy[i];
            this.destroyRecord(storeKey);
        }
    },

    // === Low level (primarily internal) API: uses storeKey ===================

    /**
        Method: O.Store#getTypeStatus

        Get the status of a type

        Parameters:
            accountId - {String|null} The account id.
            Type      - {O.Class} The record type.

        Returns:
            {O.Status} The status of the type in the store.
    */
    getTypeStatus(accountId, Type) {
        if (!Type) {
            let status = 0;
            Type = accountId;
            for (accountId of this._accounts.keys()) {
                status |= this.getTypeStatus(accountId, Type);
            }
            return status;
        }
        return this.getAccount(accountId, Type).status.get(Type) || EMPTY;
    },

    whenTypeReady(accountId, Type) {
        if (!Type) {
            Type = accountId;
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        if (this.getTypeStatus(accountId, Type) & READY) {
            return Promise.resolve();
        } else {
            const account = this._accounts.get(accountId);
            const awaitingReadyPromise = account.awaitingReadyPromise;
            let promise = awaitingReadyPromise.get(Type);
            if (!promise) {
                promise = new Promise((resolve) => {
                    account.awaitingReadyResolve.set(Type, resolve);
                });
                awaitingReadyPromise.set(Type, promise);
            }
            return promise;
        }
    },

    /**
        Method: O.Store#getTypeState

        Get the current client state token for a type.

        Parameters:
            accountId - {String|null} The account id.
            Type      - {O.Class} The record type.

        Returns:
            {String|null} The client's current state token for the type.
    */
    getTypeState(accountId, Type) {
        return this.getAccount(accountId, Type).clientState.get(Type) || null;
    },

    /**
        Method: O.Store#getStatus

        Get the status of a record with a given store key.

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Status} The status of the record with that store key.
    */
    getStatus(storeKey) {
        return this._skToStatus.get(storeKey) || EMPTY;
    },

    /**
        Method: O.Store#setStatus

        Set the status of a record with a given store key.

        Parameters:
            storeKey - {String} The store key of the record.
            status   - {O.Status} The new status for the record.

        Returns:
            {O.Store} Returns self.
    */
    setStatus(storeKey, status) {
        const previousStatus = this.getStatus(storeKey);
        const record = this._skToRecord.get(storeKey);
        if (previousStatus !== status) {
            this._skToStatus.set(storeKey, status);
            // wasReady !== isReady
            if ((previousStatus ^ status) & READY) {
                this._recordDidChange(storeKey);
            }
            if (record) {
                record.propertyDidChange('status', previousStatus, status);
            }
            for (const nested of this._nestedStores) {
                nested.parentDidChangeStatus(storeKey, previousStatus, status);
            }
        }
        return this;
    },

    /**
        Method: O.Store#getRecordFromStoreKey

        Returns a record object for a particular store key, creating it if it
        does not already exist and fetching its value if not already loaded in
        memory, unless the doNotFetch parameter is set.

        Parameters:
            storeKey   - {String} The record store key.
            doNotFetch - {Boolean} (optional) If true, the record data will not
                         be fetched from the server if it is not already loaded.

        Returns:
            {O.Record} Returns the requested record.
    */
    getRecordFromStoreKey(storeKey, doNotFetch) {
        const record = this.materialiseRecord(storeKey);
        // If the caller is already handling the fetching, they can
        // set doNotFetch to true.
        if (!doNotFetch && this.getStatus(storeKey) === EMPTY) {
            this.fetchData(storeKey);
        }
        // Add timestamp for memory manager.
        this._skToLastAccess.set(storeKey, Date.now());
        return record;
    },

    /**
        Method: O.Store#setRecordForStoreKey

        Sets the record instance for a store key.

        Parameters:
            storeKey - {String} The store key of the record.
            record   - {O.Record} The record.

        Returns:
            {O.Store} Returns self.
    */
    setRecordForStoreKey(storeKey, record) {
        this._skToRecord.set(storeKey, record);
        return this;
    },

    /**
        Method: O.Store#materialiseRecord

        Returns the record object for a given store key, creating it if this is
        the first time it has been requested.

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Record} Returns the requested record.
    */
    materialiseRecord(storeKey) {
        let record = this._skToRecord.get(storeKey);
        if (!record) {
            const Type = this._skToType.get(storeKey);
            record = new Type(this, storeKey);
            this._skToRecord.set(storeKey, record);
        }
        return record;
    },

    // ---

    /**
        Method: O.Store#mayUnloadRecord

        Called before unloading a record from memory. Checks the record is in a
        clean state and does not have any observers and that every nested store
        also has no objection to unloading the record.

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {Boolean} True if the store may unload the record.
    */
    mayUnloadRecord(storeKey) {
        const record = this._skToRecord.get(storeKey);
        const status = this.getStatus(storeKey);
        // Only unload unwatched clean, non-committing records.
        if (
            status & (COMMITTING | NEW | DIRTY) ||
            (record && record.hasObservers())
        ) {
            return false;
        }
        for (const nested of this._nestedStores) {
            if (!nested.mayUnloadRecord(storeKey)) {
                return false;
            }
        }
        return true;
    },

    /**
        Method: O.Store#willUnloadRecord

        Called just before the record is removed from memory. If the record has
        been instantiated it will call <O.Record#storeWillUnload>. The method is
        then recursively called on nested stores.

        Parameters:
            storeKey - {String} The store key of the record being unloaded.

        Returns:
            {O.Store} Returns self.
    */
    willUnloadRecord(storeKey) {
        const record = this._skToRecord.get(storeKey);
        if (record) {
            record.storeWillUnload();
        }
        for (const nested of this._nestedStores) {
            nested.willUnloadRecord(storeKey);
        }
        return this;
    },

    /**
        Method: O.Store#unloadRecord

        Unloads everything about a record from the store, freeing up memory,
        providing it is safe to do so. Will have no effect if
        <O.Store#mayUnloadRecord> returns false for the given store key.

        Parameters:
            storeKey - {String} The store key of the record to be unloaded.

        Returns:
            {Boolean} Was the record unloaded?
    */
    unloadRecord(storeKey) {
        if (!this.mayUnloadRecord(storeKey)) {
            return false;
        }
        this.willUnloadRecord(storeKey);

        this._skToLastAccess.delete(storeKey);
        this._skToRecord.delete(storeKey);
        this._skToRollback.delete(storeKey);
        this._skToData.delete(storeKey);
        this._skToStatus.delete(storeKey);

        // Can't delete id/sk mapping without checking if we have any other
        // references to this key elsewhere (as either a foreign key or in a
        // remote query). For now just always keep.

        return true;
    },

    // ---

    /**
        Method: O.Store#createRecord

        Creates a new record with the given store key. The existing status for
        the store key must be <O.Status.EMPTY>. An initial data object may be
        passed as a second argument. The new record will be committed back to
        the server the next time <O.Store#commitChanges> runs.

        You will not normally use this method; instead just create a new record
        using `new ORecordSubclass()` and then call <O.Record#saveToStore>.

        Parameters:
            storeKey - {String} The store key of the new record.
            data     - {Object} (optional) The initial data for the record.

        Returns:
            {O.Store} Returns self.
    */
    createRecord(storeKey, data, _isCopyOfStoreKey) {
        const status = this.getStatus(storeKey);
        if (status !== EMPTY && status !== DESTROYED) {
            didError({
                name: CANNOT_CREATE_EXISTING_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                    (keyOf(Status, status) || status) +
                    '\nData: ' +
                    JSON.stringify(data),
            });
            return this;
        }

        if (!data) {
            data = {};
        }
        data.accountId = this.getAccountIdFromStoreKey(storeKey);

        this._created.set(storeKey, _isCopyOfStoreKey || 0);
        this._skToData.set(storeKey, data);

        this.setStatus(storeKey, READY | NEW | DIRTY);

        if (this.autoCommit) {
            this.commitChanges();
        }

        return this.set('hasChanges', true);
    },

    /**
        Method: O.Store#moveRecord

        Creates a copy of a record with the given store key in a different
        account and destroys the original.

        Parameters:
            storeKey    - {String} The store key of the record to copy
            toAccountId - {String} The id of the account to copy to

        Returns:
            {String} The store key of the copy.
    */
    moveRecord(storeKey, toAccountId, copyStoreKey) {
        const createdFrom = this._created.get(storeKey);
        if (
            this.getStatus(storeKey) === (READY | NEW | DIRTY) &&
            (!createdFrom ||
                toAccountId !== this.getAccountIdFromStoreKey(createdFrom))
        ) {
            this.updateData(
                storeKey,
                {
                    accountId: toAccountId,
                },
                true,
            );
            return storeKey;
        }
        const Type = this._skToType.get(storeKey);
        const copyData = clone(this._skToData.get(storeKey));
        copyStoreKey = copyStoreKey || createdFrom;
        if (copyStoreKey) {
            this.undestroyRecord(copyStoreKey, Type, copyData, storeKey);
        } else {
            copyStoreKey = this.getStoreKey(toAccountId, Type);
            this.createRecord(copyStoreKey, copyData, storeKey);
        }
        // Swizzle the storeKey on records
        this._changeRecordStoreKey(storeKey, copyStoreKey);
        // Revert data, because the change is all in the copy now.
        this.revertData(storeKey);
        this.destroyRecord(storeKey, copyStoreKey);
        return copyStoreKey;
    },

    _changeRecordStoreKey(oldStoreKey, newStoreKey) {
        const { _skToRecord } = this;
        const record = _skToRecord.get(oldStoreKey);
        if (record) {
            _skToRecord.delete(oldStoreKey);
            _skToRecord.set(newStoreKey, record);
            record
                .set('storeKey', newStoreKey)
                .computedPropertyDidChange('accountId');
        }
        for (const nested of this._nestedStores) {
            nested._changeRecordStoreKey(oldStoreKey, newStoreKey);
        }
    },

    /**
        Method: O.Store#destroyRecord

        Marks a record as destroyed and commits this back to the server when
        O.Store#commitChanges next runs. If the record is new it is immediately
        unloaded from memory, otherwise the store waits until the destroy has
        been committed.

        You will not normally use this method; instead just call
        <O.Record#destroy> on the record object itself.

        Parameters:
            storeKey - {String} The store key of the record to be destroyed.

        Returns:
            {O.Store} Returns self.
    */
    destroyRecord(storeKey, _ifCopiedStoreKey) {
        const status = this.getStatus(storeKey);
        // If created -> just remove from created.
        if (status === (READY | NEW | DIRTY)) {
            this._created.delete(storeKey);
            this.setStatus(storeKey, DESTROYED);
            this.unloadRecord(storeKey);
        } else if (status & READY) {
            // Discard changes if dirty.
            if (status & DIRTY) {
                this.setData(storeKey, this._skToCommitted.get(storeKey));
                this._skToCommitted.delete(storeKey);
                this._skToChanged.delete(storeKey);
                if (this.isNested) {
                    this._skToData.delete(storeKey);
                }
            }
            this._destroyed.set(storeKey, _ifCopiedStoreKey || 0);
            // Maintain COMMITTING flag so we know to wait for that to finish
            // before committing the destroy.
            // Maintain NEW flag as we have to wait for commit to finish (so we
            // have an id) before we can destroy it.
            // Maintain OBSOLETE flag in case we have to roll back.
            this.setStatus(
                storeKey,
                DESTROYED | DIRTY | (status & (COMMITTING | NEW | OBSOLETE)),
            );
            if (this.autoCommit) {
                this.commitChanges();
            }
        }
        return mayHaveChanges(this);
    },

    undestroyRecord(storeKey, Type, data, _isCopyOfStoreKey) {
        const status = this.getStatus(storeKey);
        if (data) {
            data = filterObject(data, Record.getClientSettableAttributes(Type));
        }
        if (status === EMPTY || status === DESTROYED) {
            this.createRecord(storeKey, data, _isCopyOfStoreKey);
        } else {
            if ((status & ~(OBSOLETE | LOADING)) === (DESTROYED | COMMITTING)) {
                this.setStatus(storeKey, READY | NEW | COMMITTING);
                this._created.set(storeKey, _isCopyOfStoreKey || 0);
            } else if (status & DESTROYED) {
                this.setStatus(
                    storeKey,
                    (status & ~(DESTROYED | DIRTY)) | READY,
                );
                this._destroyed.delete(storeKey);
            }
            if (data) {
                this.updateData(storeKey, data, true);
            }
        }
        return mayHaveChanges(this);
    },

    // ---

    /**
        Method: O.Store#checkServerState

        Called internally when a type finishes loading or committing, to check
        if there's a server state update to process.

        Parameters:
            accountId - {String|null} The account id.
            Type      - {O.Class} The record type.
    */
    checkServerState(accountId, Type) {
        if (!accountId) {
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        const typeToServerState = this._accounts.get(accountId).serverState;
        const serverState = typeToServerState.get(Type);
        if (serverState) {
            typeToServerState.set(Type, '');
            this.sourceStateDidChange(accountId, Type, serverState);
        }
    },

    /**
        Method: O.Store#fetchAll

        Fetches all records of a given type from the server, or if already
        fetched updates the set of records.

        Parameters:
            accountId - {String|null} (optional) The account id. Omit to fetch
                        for all accounts.
            Type  - {O.Class} The type of records to fetch.
            force - {Boolean} (optional) Fetch even if we have a state string.

        Returns:
            {O.Store} Returns self.
    */
    fetchAll(accountId, Type, force) {
        // If accountId omitted => fetch all
        if (typeof accountId === 'function') {
            force = Type;
            Type = accountId;

            for (const [id, account] of this._accounts) {
                if (id && Type.dataGroup in account.accountCapabilities) {
                    this.fetchAll(id, Type, force);
                }
            }
            return this;
        }

        if (!accountId) {
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        const account = this._accounts.get(accountId);
        const typeToStatus = account.status;
        const status = typeToStatus.get(Type);
        const state = account.clientState.get(Type);

        if (!(status & LOADING) && (!(status & READY) || force)) {
            this.source.fetchAllRecords(accountId, Type, state, () => {
                typeToStatus.set(Type, typeToStatus.get(Type) & ~LOADING);
                this.checkServerState(accountId, Type);
            });
            typeToStatus.set(Type, (typeToStatus.get(Type) || 0) | LOADING);
        }
        return this;
    },

    // ---

    /**
        Method: O.Store#fetchData

        Fetches the data for a given record from the server.

        Parameters:
            storeKey - {String} The store key of the record to fetch.

        Returns:
            {O.Store} Returns self.
    */
    fetchData(storeKey) {
        const status = this.getStatus(storeKey);
        // Nothing to do if already loading or new, destroyed or non-existent.
        if (status & (LOADING | NEW | DESTROYED | NON_EXISTENT)) {
            return this;
        }
        const Type = this._skToType.get(storeKey);
        if (!Type) {
            return this;
        }
        const skToId = this._typeToSKToId.get(Type);
        const id = skToId && skToId.get(storeKey);
        if (!id) {
            return this;
        }
        const accountId = this.getAccountIdFromStoreKey(storeKey);

        let callback;
        if (id === 'singleton') {
            const typeToStatus = this._accounts.get(accountId).status;
            typeToStatus.set(Type, (typeToStatus.get(Type) || 0) | LOADING);
            callback = () => {
                typeToStatus.set(Type, typeToStatus.get(Type) & ~LOADING);
                this.checkServerState(accountId, Type);
            };
        }

        if (status & EMPTY) {
            this.source.fetchRecord(accountId, Type, id, callback);
            this.setStatus(storeKey, EMPTY | LOADING);
        } else {
            this.source.refreshRecord(accountId, Type, id, callback);
            this.setStatus(storeKey, status | LOADING);
        }
        return this;
    },

    /**
        Method: O.Store#getData

        Returns the current data object in memory for the given record

        Parameters:
            storeKey - {String} The store key for the record.

        Returns:
            {Object|undefined} The record data, if loaded.
    */
    getData(storeKey) {
        return this._skToData.get(storeKey);
    },

    /**
        Method: O.Store#setData

        Sets the data object for a given record.

        Parameters:
            storeKey      - {String} The store key for the record.
            data          - {Object} The new data object for the record.

        Returns:
            {O.Store} Returns self.
    */
    setData(storeKey, data) {
        if (this.getStatus(storeKey) & READY) {
            this.updateData(storeKey, data, false);
        } else {
            const changedKeys = Object.keys(data);
            this._skToData.set(storeKey, data);
            this._notifyRecordOfChanges(storeKey, changedKeys);
            for (const nested of this._nestedStores) {
                nested.parentDidSetData(storeKey, changedKeys);
            }
        }
        return this;
    },

    /**
        Method: O.Store#updateData

        Updates the data object for a given record with the supplied attributes.

        Parameters:
            storeKey      - {String} The store key for the record.
            data          - {Object} An object of new attribute values for the
                            record.
            changeIsDirty - {Boolean} Should any of the change be committed back
                            to the server? noSync attributes are filtered out of
                            commits to the server in the commitChanges method.

        Returns:
            {Boolean} Was the data actually written? Will be false if the
            changeIsDirty flag is set but the current data is not yet loaded
            into memory.
    */
    updateData(storeKey, data, changeIsDirty) {
        const status = this.getStatus(storeKey);
        const { _skToData, _skToCommitted, _skToChanged, isNested } = this;
        let current = _skToData.get(storeKey);
        const changedKeys = [];
        let seenChange = false;

        if (!current || (changeIsDirty && !(status & READY))) {
            didError({
                name: CANNOT_WRITE_TO_UNREADY_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                    (keyOf(Status, status) || status) +
                    '\nData: ' +
                    JSON.stringify(data),
            });
            return false;
        }

        // Copy-on-write for nested stores. ownHas distinguishes own data
        // from data inherited via the parent chain.
        if (isNested && !_skToData.ownHas(storeKey)) {
            current = clone(current);
            _skToData.set(storeKey, current);
        }

        if (changeIsDirty && status !== (READY | NEW | DIRTY)) {
            let committed = _skToCommitted.get(storeKey);
            if (!committed) {
                committed = clone(current);
                _skToCommitted.set(storeKey, committed);
            }
            let changed = _skToChanged.get(storeKey);
            if (!changed) {
                changed = {};
                _skToChanged.set(storeKey, changed);
            }

            for (const key in data) {
                const value = data[key];
                const oldValue = current[key];
                if (!isEqual(value, oldValue)) {
                    current[key] = value;
                    changedKeys.push(key);
                    changed[key] = !isEqual(value, committed[key]);
                    seenChange = seenChange || changed[key];
                }
            }
            // If we just reset properties to their committed values, we should
            // check to see if there are any changes remaining.
            if (!seenChange) {
                for (const key in changed) {
                    if (changed[key]) {
                        seenChange = true;
                        break;
                    }
                }
            }
            // If there are still changes remaining, set the DIRTY flag and
            // commit. Otherwise, remove the DIRTY flag and reset state.
            if (seenChange) {
                this.setStatus(storeKey, status | DIRTY);
                if (this.autoCommit) {
                    this.commitChanges();
                }
            } else {
                this.setStatus(storeKey, status & ~DIRTY);
                _skToCommitted.delete(storeKey);
                _skToChanged.delete(storeKey);
                if (isNested) {
                    _skToData.delete(storeKey);
                }
            }
            mayHaveChanges(this);
        } else {
            for (const key in data) {
                const value = data[key];
                const oldValue = current[key];
                if (!isEqual(value, oldValue)) {
                    current[key] = value;
                    changedKeys.push(key);
                }
            }
        }

        // If the record is new (so not in other stores), update the accountId
        // associated with the record.
        const accountId = data.accountId;
        if (status === (READY | NEW | DIRTY) && accountId) {
            this._skToAccountId.set(storeKey, accountId);
        }

        this._notifyRecordOfChanges(storeKey, changedKeys);
        for (const nested of this._nestedStores) {
            nested.parentDidUpdateData(storeKey, changedKeys);
        }
        this._recordDidChange(storeKey);
        return true;
    },

    /**
        Method: O.Store#revertData

        Reverts the data object for a given record to the last committed state.

        Parameters:
            storeKey - {String} The store key for the record.

        Returns:
            {O.Store} Returns self.
    */
    revertData(storeKey) {
        const Type = this._skToType.get(storeKey);
        const committed = this._skToCommitted.get(storeKey);
        const changed = this._skToChanged.get(storeKey);

        if (committed) {
            const proto = Type.prototype;
            const attrs = meta(proto).attrs;
            let defaultValue;
            for (const attrKey in changed) {
                if (committed[attrKey] === undefined) {
                    defaultValue = proto[attrs[attrKey]].defaultValue;
                    if (defaultValue === undefined) {
                        defaultValue = null;
                    }
                    committed[attrKey] = defaultValue;
                }
            }
            this.updateData(storeKey, committed, true);
        }

        return this;
    },

    /**
        Method (private): O.Store#_notifyRecordOfChanges

        Triggers change notifications if this record has an instantiated
        instance, and informs nested stores so they can do likewise.

        Parameters:
            storeKey    - {String} The store key of the record with changes.
            changedKeys - {Array} A list of the properties which have changed.

        Returns:
            {O.Store} Returns self.
    */
    _notifyRecordOfChanges(storeKey, changedKeys) {
        const record = this._skToRecord.get(storeKey);
        if (record) {
            let errorForAttribute;
            const attrs = meta(record).attrs;
            record.beginPropertyChanges();
            for (let i = changedKeys.length - 1; i >= 0; i -= 1) {
                const attrKey = changedKeys[i];
                let propKey = attrs[attrKey];
                // Server may return more data than is defined in the record;
                // ignore the rest.
                if (!propKey) {
                    // Special case: implicit id/accountId attributes
                    if (attrKey === 'id' || attrKey === 'accountId') {
                        propKey = attrKey;
                    } else {
                        continue;
                    }
                }
                const attribute = record[propKey];
                record.computedPropertyDidChange(propKey);
                if (attribute.validate) {
                    if (!errorForAttribute) {
                        errorForAttribute = record.get('errorForAttribute');
                    }
                    errorForAttribute.set(
                        propKey,
                        attribute.validate(
                            record.get(propKey),
                            propKey,
                            record,
                        ),
                    );
                }
            }
            record.endPropertyChanges();
        }
        return this;
    },

    /**
        Method: O.Store#_recordDidChange

        Called when the status and/or data for a record changes.

        Parameters:
            storeKey - {String} The store key of the record.
    */
    _recordDidChange(storeKey) {
        this._changedTypes.add(this._skToType.get(storeKey));
        queueFn('middle', this._fireTypeChanges, this);
    },

    /**
        Method: O.Store#_fireTypeChanges
    */
    _fireTypeChanges() {
        const { _changedTypes } = this;
        this._changedTypes = new Set();

        for (const Type of _changedTypes) {
            this.fire(guid(Type));
        }

        return this;
    },

    // === Queries =============================================================

    /**
        Method: O.Store#findAll

        Returns the list of store keys with data loaded for a particular type,
        optionally filtered and/or sorted.

        Parameters:
            Type   - {O.Class} The constructor for the record type being
                     queried.
            filter - {Function} (optional) An acceptance function. This will be
                     passed the raw data object (*not* a record instance) and
                     should return true if the record should be included, or
                     false otherwise.
            sort   - {Function} (optional) A comparator function. This will be
                     passed the raw data objects (*not* record instances) for
                     two records. It should return -1 if the first record should
                     come before the second, 1 if the inverse is true, or 0 if
                     they should have the same position.

        Returns:
            {String[]} An array of store keys.
    */
    findAll(Type, accept, compare) {
        const skToId = this._typeToSKToId.get(Type);
        const { _skToStatus } = this;
        let results = [];

        if (skToId) {
            for (const storeKey of skToId.keys()) {
                if (_skToStatus.get(storeKey) & READY) {
                    results.push(storeKey);
                }
            }
        }

        if (accept) {
            const filterFn = acceptStoreKey.bind(this, accept);
            results = results.filter(filterFn);
            results.filterFn = filterFn;
        }

        if (compare) {
            const sortFn = compareStoreKeys.bind(this, compare);
            results.sort(sortFn);
            results.sortFn = sortFn;
        }

        return results;
    },

    /**
        Method: O.Store#findOne

        Returns the store key of the first loaded record that matches an
        acceptance function.

        Parameters:
            Type   - {O.Class} The constructor for the record type to find.
            filter - {Function} (optional) An acceptance function. This will be
                     passed the raw data object (*not* a record instance) and
                     should return true if the record is the desired one, or
                     false otherwise.

        Returns:
            {(String|null)} The store key for a matching record, or null if none
            found.
    */
    findOne(Type, accept) {
        const _skToId = this._typeToSKToId.get(Type);
        if (!_skToId) {
            return null;
        }
        const { _skToStatus } = this;
        const filterFn = accept && acceptStoreKey.bind(this, accept);

        for (const storeKey of _skToId.keys()) {
            if (
                _skToStatus.get(storeKey) & READY &&
                (!filterFn || filterFn(storeKey))
            ) {
                return storeKey;
            }
        }

        return null;
    },

    /**
        Method: O.Store#addQuery

        Registers a query with the store. This is automatically called by the
        query constructor function. You should never need to call this
        manually.

        Parameters:
            query - {O.Query} The query object.

        Returns:
            {O.Store} Returns self.
    */
    addQuery(query) {
        this._idToQuery.set(query.get('id'), query);
        return this;
    },

    /**
        Method: O.Store#removeQuery

        Deregisters a query with the store. This is automatically called when
        you call destroy() on a query. You should never need to call this
        manually.

        Parameters:
            query - {O.Query} The query object.

        Returns:
            {O.Store} Returns self.
    */
    removeQuery(query) {
        this._idToQuery.delete(query.get('id'));
        return this;
    },

    /**
        Method: O.Store#getQuery

        Get a named query. When the same query is used in different places in
        the code, use this method to get the query rather than directly calling
        new Query(...). If the query is already created it will be returned,
        otherwise it will be created and returned. If no QueryClass is supplied
        and the id does not correspond to an existing query then `null` will be
        returned.

        Parameters:
            id         - {String} The id of the requested query.
            QueryClass - {O.Class} (optional) The query class to use if the
                         query is not already created.
            mixin      - {(Object|null)} (optional) Properties to pass to the
                         QueryClass constructor.

        Returns:
            {(O.Query|null)} The requested query.
    */
    getQuery(id, QueryClass, mixin) {
        let query = (id && this._idToQuery.get(id)) || null;
        if (!query && QueryClass) {
            query = new QueryClass(
                Object.assign(mixin || {}, {
                    id,
                    store: this,
                    source: this.get('source'),
                }),
            );
        }
        if (query) {
            query.lastAccess = Date.now();
        }
        return query;
    },

    /**
        Method: O.Store#getAllQueries

        Returns a list of all remote queries registered with the store.

        Returns:
            {O.Query[]} A list of all registered queries.
    */
    getAllQueries() {
        return [...this._idToQuery.values()];
    },

    // === Source callbacks ====================================================

    /**
        Method: O.Store#sourceStateDidChange

        Call this method to notify the store of a change in the state of a
        particular record type in the source. The store will wait for any
        loading or committing of this type to finish, then check its state. If
        it doesn't match, it will then request updates.

        Parameters:
            accountId - {String|null} The account id.
            Type      - {O.Class} The record type.
            newState  - {String} The new state on the server.

        Returns:
            {O.Store} Returns self.
    */
    sourceStateDidChange(accountId, Type, newState) {
        const account = this.getAccount(accountId, Type);
        const clientState = account.clientState.get(Type);
        const oldState = account.serverState.get(Type);

        if (oldState !== newState) {
            // if !oldState => we're checking if a pushed state still needs
            // fetching. Due to concurrency, if this doesn't match newState,
            // we don't know if it's older or newer. As we're now requesting
            // updates, we can reset it to be clientState and then it will be
            // updated to the real new server automatically if has changed in
            // the sourceDidFetchUpdates handler. If a push comes in while
            // fetching the updates, this won't match and we'll fetch again.
            account.serverState.set(
                Type,
                oldState || !clientState ? newState : clientState,
            );
            if (
                newState !== clientState &&
                !account.ignoreServerState &&
                !(account.status.get(Type) & (LOADING | COMMITTING))
            ) {
                if (clientState) {
                    this.fetchAll(accountId, Type, true);
                }
                // We have a query but not matches yet; we still need to
                // refresh the queries in case there are now matches.
                this.fire(guid(Type) + ':server:' + accountId);
            }
        }

        return this;
    },

    // ---

    /**
        Method: O.Store#sourceDidFetchRecords

        Callback made by the <O.Source> object associated with this store when
        it fetches some records from the server.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            records   - {Object[]} Array of data objects.
            state     - {String} (optional) The state of the record type on the
                        server.
            isAll     - {Boolean} This is all the records of this type on the
                        server.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchRecords(accountId, Type, records, state, isAll) {
        const { _skToData, _skToLastAccess } = this;
        if (!accountId) {
            accountId = this.getPrimaryAccountIdForType(Type);
        }
        const account = this._accounts.get(accountId);
        const idPropKey = Type.primaryKey || 'id';
        const idAttrKey = Type.prototype[idPropKey].key || idPropKey;
        const now = Date.now();
        const seen = new Set();
        const updates = {};
        const foreignRefAttrs = getForeignRefAttrs(Type);

        for (let i = records.length - 1; i >= 0; i -= 1) {
            const data = records[i];
            const id = data[idAttrKey];
            const storeKey = this.getStoreKey(accountId, Type, id);
            const status = this.getStatus(storeKey);
            seen.add(storeKey);

            if (foreignRefAttrs.length) {
                convertForeignKeysToSK(this, foreignRefAttrs, data, accountId);
            }
            data.accountId = accountId;

            if (status & READY) {
                // We already have the record loaded, process it as an update.
                updates[id] = data;
            } else if (status & DESTROYED && status & (DIRTY | COMMITTING)) {
                // We're in the middle of destroying it. Update the data in case
                // we need to roll back.
                _skToData.set(storeKey, data);
                this.setStatus(storeKey, status & ~LOADING);
            } else {
                // Anything else is new.
                if (!(status & EMPTY)) {
                    // Record was destroyed or non-existent, but has now been
                    // created (again). Set status back to empty so setData
                    // works.
                    this.setStatus(storeKey, EMPTY);
                }
                this.setData(storeKey, data);
                this.setStatus(storeKey, READY);
                _skToLastAccess.set(storeKey, now);
            }
        }

        if (isAll) {
            const skToId = this._typeToSKToId.get(Type);
            if (skToId) {
                const destroyed = [];
                for (const [storeKey, id] of skToId) {
                    if (seen.has(storeKey)) {
                        continue;
                    }
                    const status = this.getStatus(storeKey);
                    if (
                        status & READY &&
                        !(status & NEW) &&
                        _skToData.get(storeKey).accountId === accountId
                    ) {
                        destroyed.push(id);
                    }
                }
                if (destroyed.length) {
                    this.sourceDidDestroyRecords(accountId, Type, destroyed);
                }
            }
        }

        this.sourceDidFetchPartialRecords(accountId, Type, updates, true);

        if (state) {
            const oldClientState = account.clientState.get(Type);
            const oldServerState = account.serverState.get(Type);
            // If the state has changed, we need to fetch updates, but we can
            // still load these records
            if (!isAll && oldClientState && oldClientState !== state) {
                this.sourceStateDidChange(accountId, Type, state);
            } else {
                account.clientState.set(Type, state);
                if (
                    !oldClientState ||
                    !oldServerState ||
                    // If oldClientState == oldServerState, then the state we've
                    // just received MUST be newer so we can update the server
                    // state too
                    oldClientState === oldServerState
                ) {
                    account.serverState.set(Type, state);
                }
            }
        }
        account.status.set(Type, (account.status.get(Type) || 0) | READY);

        const resolve = account.awaitingReadyResolve.get(Type);
        if (resolve) {
            resolve();
            account.awaitingReadyResolve.delete(Type);
            account.awaitingReadyPromise.delete(Type);
        }

        // Notify LocalQuery we're now ready even if no records loaded.
        this._changedTypes.add(Type);
        queueFn('middle', this._fireTypeChanges, this);

        return this;
    },

    /**
        Method: O.Store#sourceDidFetchPartialRecords

        Callback made by the <O.Source> object associated with this store when
        it has fetched some updates to records which may be loaded in the store.
        An update is a subset of a normal data object for the given record type,
        containing only the attributes which have changed since the previous
        state.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            updates   - {Object} An object mapping record id to an object of
                        changed attributes.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchPartialRecords(accountId, Type, updates, _idsAreSKs) {
        const account = this.getAccount(accountId, Type);
        const { _skToData, _skToStatus, _skToChanged, _skToCommitted } = this;
        const _idToSk = account.typeToIdToSK.get(Type);
        const _skToId = this._typeToSKToId.get(Type);
        const idPropKey = Type.primaryKey || 'id';
        const idAttrKey = Type.prototype[idPropKey].key || idPropKey;
        const foreignRefAttrs = _idsAreSKs ? [] : getForeignRefAttrs(Type);

        for (const id in updates) {
            const storeKey = _idToSk && _idToSk.get(id);
            const status = _skToStatus.get(storeKey);
            let update = updates[id];

            // Skip if no update to process
            // Also can't update an empty or destroyed record.
            if (!update || !(status & READY)) {
                continue;
            }

            // If the record is committing, we don't know for sure what state
            // the update was applied on top of, so fetch again to be sure.
            if (status & COMMITTING) {
                this.setStatus(storeKey, status & ~LOADING);
                this.fetchData(storeKey);
                continue;
            }

            if (foreignRefAttrs.length) {
                convertForeignKeysToSK(
                    this,
                    foreignRefAttrs,
                    update,
                    accountId,
                );
            }

            const newId = update[idAttrKey];
            if (newId && newId !== id) {
                // Don't delete the old idToSk mapping, as references to the
                // old id may still appear in queryChanges responses
                _skToId.set(storeKey, newId);
                _idToSk.set(newId, storeKey);
            }

            if (status & DIRTY) {
                // If we have a conflict we can either rebase on top, or discard
                // our local changes.
                update = Object.assign(_skToCommitted.get(storeKey), update);
                if (this.rebaseConflicts) {
                    const oldData = _skToData.get(storeKey);
                    const oldChanged = _skToChanged.get(storeKey);
                    const newData = {};
                    const newChanged = {};
                    let clean = true;
                    // Every key in here must be reapplied on top, even if
                    // changed[key] === false, as this means it's been
                    // changed then changed back.
                    for (const key in oldData) {
                        if (key in oldChanged) {
                            if (!isEqual(oldData[key], update[key])) {
                                newChanged[key] = true;
                                clean = false;
                            }
                            newData[key] = oldData[key];
                        } else {
                            newData[key] = update[key];
                        }
                    }
                    if (!clean) {
                        _skToChanged.set(storeKey, newChanged);
                        _skToCommitted.set(storeKey, update);
                        this.setData(storeKey, newData);
                        this.setStatus(storeKey, READY | DIRTY);
                        continue;
                    }
                }
                _skToChanged.delete(storeKey);
                _skToCommitted.delete(storeKey);
            }

            this.updateData(storeKey, update, false);
            this.setStatus(storeKey, READY);
        }
        return mayHaveChanges(this);
    },

    /**
        Method: O.Store#sourceDidChangeIds

        Callback made by the <O.Source> object associated with this store when
        the server has unilaterally changed the ids of some objects.

        Parameters:
            accountId    - {String} The account id.
            Type         - {O.Class} The record type.
            oldIdToNewId - {Id[Id]} Map of old to new id

        Returns:
            {O.Store} Returns self.
    */
    sourceDidChangeIds(accountId, Type, oldIdToNewId) {
        const account = this.getAccount(accountId, Type);
        const _idToSk = account.typeToIdToSK.get(Type);
        const _skToId = this._typeToSKToId.get(Type);
        const idPropKey = Type.primaryKey || 'id';
        const idAttrKey = Type.prototype[idPropKey].key || idPropKey;

        if (!_idToSk) {
            return mayHaveChanges(this);
        }

        for (const oldId in oldIdToNewId) {
            const storeKey = _idToSk.get(oldId);
            if (!storeKey) {
                continue;
            }
            const newId = oldIdToNewId[oldId];
            if (newId && newId !== oldId) {
                // Don't delete the old idToSk mapping, as references to the
                // old id may still appear in queryChanges responses
                _skToId.set(storeKey, newId);
                _idToSk.set(newId, storeKey);
            }
            if (this.getStatus(storeKey) & READY) {
                this.updateData(storeKey, { [idAttrKey]: newId }, false);
            }
        }
        return mayHaveChanges(this);
    },

    /**
        Method: O.Store#sourceCouldNotFindRecords

        Callback made by the <O.Source> object associated with this store when
        it has been asked to fetch certain record ids and the server has
        responded that the records do not exist.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            ids       - {String[]} The list of ids of non-existent requested
                        records.

        Returns:
            {O.Store} Returns self.
    */
    sourceCouldNotFindRecords(accountId, Type, ids) {
        const { _skToCommitted, _skToChanged } = this;

        for (let i = ids.length - 1; i >= 0; i -= 1) {
            const storeKey = this.getStoreKey(accountId, Type, ids[i]);
            const status = this.getStatus(storeKey);
            if (status & (EMPTY | NON_EXISTENT)) {
                this.setStatus(storeKey, NON_EXISTENT);
            } else {
                if (status & DIRTY) {
                    this.setData(storeKey, _skToCommitted.get(storeKey));
                    _skToCommitted.delete(storeKey);
                    _skToChanged.delete(storeKey);
                }
                this.setStatus(storeKey, DESTROYED);
                this.unloadRecord(storeKey);
            }
        }
        return mayHaveChanges(this);
    },

    // ---

    /**
        Method: O.Store#sourceDidFetchUpdates

        Callback made by the <O.Source> object associated with this store when
        it fetches the ids of all records of a particular type that have been
        created/modified/destroyed of a particular since the client's state.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            changed   - {String[]} List of ids for records which have been
                        added or changed in the store since oldState.
            destroyed - {String[]} List of ids for records which have been
                        destroyed in the store since oldState.
            oldState  - {String} The state these changes are from.
            newState  - {String} The state these changes are to.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchUpdates(
        accountId,
        Type,
        changed,
        destroyed,
        oldState,
        newState,
    ) {
        const account = this.getAccount(accountId, Type);
        if (oldState === account.clientState.get(Type)) {
            // Invalidate changed records
            if (changed && changed.length) {
                this.sourceDidModifyRecords(accountId, Type, changed);
            }
            if (destroyed && destroyed.length) {
                this.sourceDidDestroyRecords(accountId, Type, destroyed);
            }
            // Invalidate remote queries on the type, unless this was done
            // before.
            if (
                oldState !== newState &&
                newState !== account.serverState.get(Type)
            ) {
                this.fire(guid(Type) + ':server:' + accountId);
            }
            account.clientState.set(Type, newState);
            if (account.serverState.get(Type) === oldState) {
                account.serverState.set(Type, newState);
            }
        } else {
            this.sourceStateDidChange(accountId, Type, newState);
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidModifyRecords

        Callback made by the <O.Source> object associated with this store when
        some records may be out of date.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            ids       - {String[]} The list of ids of records which have
                        updates available on the server.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidModifyRecords(accountId, Type, ids) {
        for (let i = ids.length - 1; i >= 0; i -= 1) {
            const storeKey = this.getStoreKey(accountId, Type, ids[i]);
            const status = this.getStatus(storeKey);
            if (status & READY) {
                this.setStatus(storeKey, status | OBSOLETE);
            }
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidDestroyRecords

        Callback made by the <O.Source> object associated with this store when
        the source has destroyed records (not in response to a commit request
        by the client).

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            ids       - {String[]} The list of ids of records which have been
                        destroyed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidDestroyRecords(accountId, Type, ids) {
        for (let i = ids.length - 1; i >= 0; i -= 1) {
            const id = ids[i];
            const storeKey = this.getStoreKey(accountId, Type, id);
            // If we have an immutable record, an "update" may have actually
            // been a destroy and create. We may have updated the old record,
            // but the previous id => sk mapping stays to allow query changes
            // to work. So we need to check the reverse mapping gives the
            // original id before updating the store with the destroy.
            if (this.getIdFromStoreKey(storeKey) === id) {
                this.setStatus(storeKey, DESTROYED);
                this.unloadRecord(storeKey);
            }
        }
        return this;
    },

    // ---

    /**
        Method: O.Store#sourceCommitDidChangeState

        Callback made by the <O.Source> object associated with this store when
        it finishes committing a record type which uses state tokens to stay in
        sync with the server.

        Parameters:
            accountId - {String} The account id.
            Type      - {O.Class} The record type.
            oldState  - {String} The state before the commit.
            newState  - {String} The state after the commit.

        Returns:
            {O.Store} Returns self.
    */
    sourceCommitDidChangeState(accountId, Type, oldState, newState) {
        const account = this.getAccount(accountId, Type);

        if (account.clientState.get(Type) === oldState) {
            account.clientState.set(Type, newState);
            if (account.serverState.get(Type) === oldState) {
                account.serverState.set(Type, newState);
            }
        } else {
            this.sourceStateDidChange(accountId, Type, newState);
        }

        return this;
    },

    // ---

    /**
        Method: O.Store#sourceDidCommitCreate

        Callback made by the <O.Source> object associated with this store when
        the source commits the creation of records as requested by a call to
        <O.Source#commitChanges>.

        Parameters:
            skToPartialData - {Object} A map of the store key to an object
            with properties for the newly created record, which MUST include
            the id.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidCommitCreate(skToPartialData) {
        const { _skToType, _skToData, _typeToSKToId, _accounts } = this;
        // Plain-object keys are strings; storeKeys are numeric internally.
        for (const storeKeyStr in skToPartialData) {
            const storeKey = +storeKeyStr;
            const status = this.getStatus(storeKey);
            if (status & NEW) {
                const data = skToPartialData[storeKey];

                const Type = _skToType.get(storeKey);
                const idPropKey = Type.primaryKey || 'id';
                const idAttrKey = Type.prototype[idPropKey].key || idPropKey;
                const accountId = _skToData.get(storeKey).accountId;
                const id = data[idAttrKey];
                const typeToIdToSK = _accounts.get(accountId).typeToIdToSK;
                let skToId = _typeToSKToId.get(Type);
                if (!skToId) {
                    skToId = new Map();
                    _typeToSKToId.set(Type, skToId);
                }
                let idToSK = typeToIdToSK.get(Type);
                if (!idToSK) {
                    idToSK = new Map();
                    typeToIdToSK.set(Type, idToSK);
                }

                // Set id internally
                skToId.set(storeKey, id);
                idToSK.set(id, storeKey);

                const foreignRefAttrs = getForeignRefAttrs(Type);
                if (foreignRefAttrs.length) {
                    convertForeignKeysToSK(
                        this,
                        foreignRefAttrs,
                        data,
                        accountId,
                    );
                }

                // Notify record, and update with any other data
                this.updateData(storeKey, data, false);
                this.setStatus(storeKey, status & ~(COMMITTING | NEW));
            } else {
                didError({
                    name: SOURCE_COMMIT_CREATE_MISMATCH_ERROR,
                });
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidNotCreate

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the creation of some records as requested
        by a call to <O.Source#commitChanges>.

        If the condition is temporary (for example a precondition fail, such as
        the server being in a different state to the client) then the store
        will attempt to recommit the changes the next time commitChanges is
        called (or at the end of the current run loop if `autoCommit` is
        `true`); it is presumed that the precondition will be fixed before then.

        If the condition is permanent (as indicated by the `isPermanent`
        argument), the store will revert to the last known committed state,
        i.e. it will destroy the new record. If an `errors` array is passed,
        the store will first fire a `record:commit:error` event on the
        record (including in nested stores), if already instantiated. If
        <O.Event#preventDefault> is called on the event object, the record
        will **not** be reverted; it is up to the handler to then fix the record
        before it is recommitted.

        Parameters:
            storeKeys   - {String[]} The list of store keys of records for
                          which the creation was not committed.
            isPermanent - {Boolean} (optional) Should the store try to commit
                          the changes again, or just revert to last known
                          committed state?
            errors      - {Object[]} (optional) An array of objects
                          representing the error in committing the store key in
                          the equivalent location in the *storeKeys* argument.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotCreate(storeKeys, isPermanent, errors) {
        const { _skToCommitted, _skToChanged, _created } = this;

        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            const status = this.getStatus(storeKey);
            if (status & DESTROYED) {
                this.setStatus(storeKey, DESTROYED);
                this.unloadRecord(storeKey);
            } else {
                if (status & DIRTY) {
                    _skToCommitted.delete(storeKey);
                    _skToChanged.delete(storeKey);
                }
                this.setStatus(storeKey, READY | NEW | DIRTY);
                _created.set(storeKey, 0);
                if (
                    isPermanent &&
                    (!errors || !this._notifyRecordOfError(storeKey, errors[i]))
                ) {
                    this.destroyRecord(storeKey);
                }
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return mayHaveChanges(this);
    },

    /**
        Method: O.Store#sourceDidCommitUpdate

        Callback made by the <O.Source> object associated with this store when
        the source commits updates to some records as requested by a call to
        <O.Source#commitChanges>.

        Parameters:
            storeKeys - {String[]} The list of store keys of records for
                        which the submitted updates have been committed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidCommitUpdate(storeKeys) {
        const { _skToRollback } = this;

        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            const status = this.getStatus(storeKey);
            _skToRollback.delete(storeKey);
            if (status !== EMPTY) {
                this.setStatus(storeKey, status & ~COMMITTING);
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidNotUpdate

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the updates to some records as requested
        by a call to <O.Source#commitChanges>.

        If the condition is temporary (for example a precondition fail, such as
        the server being in a different state to the client) then the store
        will attempt to recommit the changes the next time commitChanges is
        called (or at the end of the current run loop if `autoCommit` is
        `true`); it is presumed that the precondition will be fixed before then.

        If the condition is permanent (as indicated by the `isPermanent`
        argument), the store will revert to the last known committed state.
        If an `errors` array is passed, the store will first fire a
        `record:commit:error` event on the record (including in nested stores),
        if already instantiated. If <O.Event#preventDefault> is called on the
        event object, the record will **not** be reverted; it is up to the
        handler to then fix the record before it is recommitted.

        Parameters:
            storeKeys   - {String[]} The list of store keys of records for
                          which the update was not committed.
            isPermanent - {Boolean} (optional) Should the store try to commit
                          the changes again, or just revert to last known
                          committed state?
            errors      - {Object[]} (optional) An array of objects
                          representing the error in committing the store key in
                          the equivalent location in the *storeKeys* argument.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotUpdate(storeKeys, isPermanent, errors) {
        const {
            _skToData,
            _skToChanged,
            _skToCommitted,
            _skToRollback,
            _skToType,
        } = this;

        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            const status = this.getStatus(storeKey);
            const rollback = _skToRollback.get(storeKey);
            // If destroyed now, but still in memory, revert the data so
            // that if the destroy fails we still have the right data.
            if (status & DESTROYED && rollback) {
                _skToData.set(storeKey, rollback);
                _skToRollback.delete(storeKey);
            }
            // Other than that, we don't care about unready records
            if (!(status & READY)) {
                // But make sure we know it's no longer committing.
                if (status !== EMPTY) {
                    this.setStatus(storeKey, status & ~COMMITTING);
                }
                continue;
            }
            const committed = rollback;
            _skToCommitted.set(storeKey, committed);
            _skToRollback.delete(storeKey);
            const current = _skToData.get(storeKey);
            _skToChanged.delete(storeKey);
            const changed = getChanged(
                _skToType.get(storeKey),
                current,
                committed,
            );
            if (changed) {
                _skToChanged.set(storeKey, changed);
                this.setStatus(storeKey, (status & ~COMMITTING) | DIRTY);
            } else {
                this.setStatus(storeKey, status & ~COMMITTING);
            }
            if (
                isPermanent &&
                (!errors || !this._notifyRecordOfError(storeKey, errors[i]))
            ) {
                this.revertData(storeKey);
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return mayHaveChanges(this);
    },

    /**
        Method: O.Store#sourceDidCommitDestroy

        Callback made by the <O.Source> object associated with this store when
        the source commits the destruction of some records as requested by a
        call to <O.Source#commitChanges>.

        Parameters:
            storeKeys - {String[]} The list of store keys of records whose
                        destruction has been committed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidCommitDestroy(storeKeys) {
        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            const status = this.getStatus(storeKey);

            // If the record has been undestroyed while being committed
            // it will no longer be in the destroyed state, but instead be
            // READY|NEW|COMMITTING.
            if ((status & ~DIRTY) === (READY | NEW | COMMITTING)) {
                if (status & DIRTY) {
                    this._skToCommitted.delete(storeKey);
                    this._skToChanged.delete(storeKey);
                }
                this.setStatus(storeKey, READY | NEW | DIRTY);
            } else if (status & DESTROYED) {
                this.setStatus(storeKey, DESTROYED);
                this.unloadRecord(storeKey);
            } else {
                didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR,
                });
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return mayHaveChanges(this);
    },

    /**
        Method: O.Store#sourceDidNotDestroy

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the destruction of some records as requested
        by a call to <O.Source#commitChanges> (usually due to a precondition
        fail, such as the server being in a different state to the client).

        If the condition is temporary (for example a precondition fail, such as
        the server being in a different state to the client) then the store
        will attempt to recommit the changes the next time commitChanges is
        called (or at the end of the current run loop if `autoCommit` is
        `true`); it is presumed that the precondition will be fixed before then.

        If the condition is permanent (as indicated by the `isPermanent`
        argument), the store will revert to the last known committed state
        (i.e. the record will be revived). If an `errors` array is passed, the
        store will first fire a `record:commit:error` event on the record
        (including in nested stores), if already instantiated. If
        <O.Event#preventDefault> is called on the event object, the record will
        **not** be revived; it is up to the handler to then fix the record
        before it is recommitted.

        Parameters:
            storeKeys   - {String[]} The list of store keys of records for
                          which the destruction was not committed.
            isPermanent - {Boolean} (optional) Should the store try to commit
                          the changes again, or just revert to last known
                          committed state?
            errors      - {Object[]} (optional) An array of objects
                          representing the error in committing the store key in
                          the equivalent location in the *storeKeys* argument.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotDestroy(storeKeys, isPermanent, errors) {
        const { _created, _destroyed } = this;

        for (let i = storeKeys.length - 1; i >= 0; i -= 1) {
            const storeKey = storeKeys[i];
            const status = this.getStatus(storeKey);
            if ((status & ~DIRTY) === (READY | NEW | COMMITTING)) {
                this.setStatus(storeKey, status & ~(COMMITTING | NEW));
                _created.delete(storeKey);
            } else if (status & DESTROYED) {
                this.setStatus(storeKey, (status & ~COMMITTING) | DIRTY);
                _destroyed.set(storeKey, 0);
                if (
                    isPermanent &&
                    (!errors || !this._notifyRecordOfError(storeKey, errors[i]))
                ) {
                    this.undestroyRecord(storeKey);
                }
            } else {
                didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR,
                });
            }
        }
        if (this.autoCommit) {
            this.commitChanges();
        }
        return mayHaveChanges(this);
    },

    _notifyRecordOfError(storeKey, error) {
        const record = this._skToRecord.get(storeKey);
        let isDefaultPrevented = false;
        const event = new Event(error.type || 'error', record, error);
        if (record) {
            record.fire('record:commit:error', event);
        } else {
            // The event will normally bubble from the record to the store.
            // If no record, fire directly on the store in case there are
            // observers attached here.
            this.fire('record:commit:error', event);
        }
        isDefaultPrevented = event.defaultPrevented;
        for (const nested of this._nestedStores) {
            isDefaultPrevented =
                nested._notifyRecordOfError(storeKey, error) ||
                isDefaultPrevented;
        }
        return isDefaultPrevented;
    },
});

['on', 'once', 'off'].forEach((property) => {
    Store.prototype[property] = function (type, object, method) {
        if (typeof type !== 'string') {
            type = guid(type);
        }
        return EventTarget[property].call(this, type, object, method);
    };
});

export { Store };
