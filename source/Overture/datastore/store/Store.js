/*global JSON */

import { Class, meta, isEqual, guid, clone } from '../../core/Core.js';
import '../../core/Object.js';  // For Object.filter and Object.keyOf
import '../../core/Array.js';  // For Array#erase
import RunLoop from '../../foundation/RunLoop.js';
import Obj from '../../foundation/Object.js';
import Event from '../../foundation/Event.js';
import EventTarget from '../../foundation/EventTarget.js';

import LiveQuery from '../query/LiveQuery.js';
import RemoteQuery from '../query/RemoteQuery.js';
import Record from '../record/Record.js';
import RecordArray from '../query/RecordArray.js';
import {
    // Core states:
    EMPTY,
    READY,
    DESTROYED,
    NON_EXISTENT,
    // Properties:
    LOADING,     // Request in progress to fetch record or updates
    COMMITTING,  // Request in progress to commit record
    NEW,         // Record is not created on source (has no source id)
    DIRTY,       // Record has local changes not yet committing
    OBSOLETE,    // Record may have changes not yet requested
} from '../record/Status.js';
// eslint-disable-next-line no-duplicate-imports
import * as Status from '../record/Status.js';
import ToOneAttribute from '../record/ToOneAttribute.js';
import ToManyAttribute from '../record/ToManyAttribute.js';

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

let sk = 1;
const generateStoreKey = function () {
    return 'k' + ( sk++ );
};

// ---

const mayHaveChanges = function ( store ) {
    RunLoop.queueFn( 'before', store.checkForChanges, store );
    return store;
};

// ---

const filter = function ( accept, storeKey ) {
    return accept( this._skToData[ storeKey ], this, storeKey );
};

const sort = function ( compare, a, b ) {
    const { _skToData } = this;
    const aIsFirst = compare( _skToData[ a ], _skToData[ b ], this );
    return aIsFirst || ( ~~a.slice( 1 ) - ~~b.slice( 1 ) );
};

// ---

const typeToForeignRefAttrs = {};

const getForeignRefAttrs = function ( Type ) {
    const typeId = guid( Type );
    let foreignRefAttrs = typeToForeignRefAttrs[ typeId ];
    let proto, attrs, attrKey, propKey, attribute;
    if ( !foreignRefAttrs ) {
        proto = Type.prototype;
        attrs = meta( proto ).attrs;
        foreignRefAttrs = [];
        for ( attrKey in attrs ) {
            propKey = attrs[ attrKey ];
            attribute = propKey && proto[ propKey ];
            if ( attribute instanceof ToOneAttribute ) {
                foreignRefAttrs.push([ attrKey, 1, attribute.Type ]);
            }
            if ( attribute instanceof ToManyAttribute ) {
                foreignRefAttrs.push([ attrKey, 0, attribute.recordType ]);
            }
        }
        typeToForeignRefAttrs[ typeId ] = foreignRefAttrs;
    }
    return foreignRefAttrs;
};

const toStoreKey = function ( store, Type, id ) {
    return store.getStoreKey( Type, id );
};

const convertForeignKeysToSK = function ( store, foreignRefAttrs, data ) {
    let i, l, foreignRef, attrKey, AttrType, value;
    for ( i = 0, l = foreignRefAttrs.length; i < l; i += 1 ) {
        foreignRef = foreignRefAttrs[i];
        attrKey = foreignRef[0];
        AttrType = foreignRef[2];
        if ( attrKey in data ) {
            value = data[ attrKey ];
            data[ attrKey ] = value && ( foreignRef[1] === 1 ?
                toStoreKey( store, AttrType, value ) :
                value.map( toStoreKey.bind( null, store, AttrType ) )
            );
        }
    }
};

const toId = function ( store, storeKey ) {
    return store.getIdFromStoreKey( storeKey ) || '#' + storeKey;
};

const convertForeignKeysToId = function ( store, Type, data ) {
    const foreignRefAttrs = getForeignRefAttrs( Type );
    let result = data;
    const l = foreignRefAttrs.length;
    for ( let i = 0; i < l; i += 1 ) {
        const foreignRef = foreignRefAttrs[i];
        const attrKey = foreignRef[0];
        if ( attrKey in data ) {
            if ( result === data ) {
                result = clone( data );
            }
            const value = data[ attrKey ];
            result[ attrKey ] = value && ( foreignRef[1] === 1 ?
                toId( store, value ) :
                value.map( toId.bind( null, store ) )
            );
        }
    }
    return result;
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
      - `OBSOLETE`: The record may have changes on the server not yet requested.
*/
const Store = Class({

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
    init (/* ...mixins */) {
        // Map store key -> record
        this._skToRecord = {};
        // Map store key -> data
        this._skToData = {};
        // Map store key -> status
        this._skToStatus = {};
        // Map store key -> Type
        this._skToType = {};
        // Map Type -> store key -> id
        this._typeToSkToId = {};
        // Map Type -> id -> store key
        this._typeToIdToSk = {};
        // Map store key -> property key -> bool (isChanged)
        this._skToChanged = {};
        // Map store key -> last committed data
        this._skToCommitted = {};
        // Map store key -> last committed data (whilst committing)
        this._skToRollback = {};

        // Map store key -> last access timestamp for memory manager
        this._skToLastAccess = {};

        // Flag if committing
        this.isCommitting = false;
        // Set of store keys for created records
        this._created = {};
        // Set of store keys for destroyed records
        this._destroyed = {};
        // Any changes waiting to be committed?
        this.hasChanges = false;

        // Queries
        // Map id -> query
        this._idToQuery = {};
        // Map Type -> list of local queries
        this._liveQueries = {};
        // Set of remote queries.
        this._remoteQueries = [];
        // List of types needing a refresh.
        this._queryTypesNeedRefresh = [];

        // List of nested stores
        this._nestedStores = [];

        // Type -> [ store key ] of changed records.
        this._typeToChangedSks = {};

        // READY      -> Some records of type loaded
        // LOADING    -> Loading or refreshing ALL records of type
        // COMMITTING -> Committing some records of type
        this._typeToStatus = {};
        // Type -> state string for type in client
        this._typeToClientState = {};
        // Type -> latest known state string for type on server
        // If committing or loading type, wait until finish to check
        this._typeToServerState = {};

        Store.parent.init.apply( this, arguments );

        if ( !this.get( 'isNested' ) ) {
            this.source.set( 'store', this );
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
    addNested ( store ) {
        this._nestedStores.push( store );
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
    removeNested ( store ) {
        this._nestedStores.erase( store );
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
            Type - {O.Class} The constructor for the record type.
            id   - {String} (optional) The id of the record.

        Returns:
            {String} Returns the store key for that record type and id.
    */
    getStoreKey ( Type, id ) {
        const typeId = guid( Type );
        const idToSk = ( this._typeToIdToSk[ typeId ] ||
                ( this._typeToIdToSk[ typeId ] = {} ) );
        const skToId = ( this._typeToSkToId[ typeId ] ||
                ( this._typeToSkToId[ typeId ] = {} ) );
        let storeKey = id && idToSk[ id ];

        if ( !storeKey ) {
            storeKey = generateStoreKey();
            this._skToType[ storeKey ] = Type;
            skToId[ storeKey ] = id;
            if ( id ) {
                idToSk[ id ] = storeKey;
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
            {(String|undefined)} Returns the id for the record, of undefined if
            the store key was not found or does not have an id (normally because
            the server assigns ids and the record has not yet been committed).
    */
    getIdFromStoreKey ( storeKey ) {
        const Type = this._skToType[ storeKey ];
        return Type &&
            ( this._typeToSkToId[ guid( Type ) ] || {} )[ storeKey ];
    },

    /**
        Method: O.Store#getTypeFromStoreKey

        Get the record type for a given store key.

        Parameters:
            storeKey - {String} The store key to get the record type for.

        Returns:
            {(Type|null)} Returns the type for the record, or `null` if the
            store key is not found.
    */
    getTypeFromStoreKey ( storeKey ) {
        return this._skToType[ storeKey ] || null;
    },

    // === Client API ==========================================================

    /**
        Method: O.Store#getRecordStatus

        Returns the status value for a given record type and id.

        Parameters:
            Type - {O.Class} The record type.
            id   - {String} The record id.

        Returns:
            {O.Status} The status in this store of the given record.
    */
    getRecordStatus ( Type, id ) {
        const _idToSk = this._typeToIdToSk[ guid( Type ) ];
        return _idToSk ? this.getStatus( _idToSk[ id ] ) : EMPTY;
    },

    /**
        Method: O.Store#getRecord

        Returns a record object for a particular type and id, creating it if it
        does not already exist and fetching its value if not already loaded in
        memory, unless the doNotFetch parameter is set.

        Parameters:
            Type       - {O.Class} The record type.
            id         - {String} The record id, or the store key prefixed with
                         a '#'.
            doNotFetch - {Boolean} (optional) If true, the record data will not
                         be fetched from the server if it is not already loaded.

        Returns:
            {O.Record|null} Returns the requested record, or null if no type or
            no id given.
    */
    getRecord ( Type, id, doNotFetch ) {
        let storeKey;
        if ( !Type || !id ) {
            return null;
        }
        if ( id.charAt( 0 ) === '#' ) {
            storeKey = id.slice( 1 );
            if ( this.getTypeFromStoreKey( storeKey ) !== Type ) {
                return null;
            }
        } else {
            storeKey = this.getStoreKey( Type, id );
        }
        const record = this.materialiseRecord( storeKey, Type );

        // If the caller is already handling the fetching, they can
        // set doNotFetch to true.
        if ( !doNotFetch && this.getStatus( storeKey ) === EMPTY ) {
            this.fetchData( storeKey );
        }
        // Add timestamp for memory manager.
        this._skToLastAccess[ storeKey ] = Date.now();
        return record;
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
    getOne ( Type, filter ) {
        const storeKey = this.findOne( Type, filter );
        return storeKey ? this.materialiseRecord( storeKey, Type ) : null;
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
    getAll ( Type, filter, sort ) {
        const storeKeys = this.findAll( Type, filter, sort );
        return new RecordArray( this, Type, storeKeys );
    },

    checkForChanges () {
        let storeKey;
        for ( storeKey in this._created ) {
            return this.set( 'hasChanges', true );
        }
        for ( storeKey in this._skToChanged ) {
            return this.set( 'hasChanges', true );
        }
        for ( storeKey in this._destroyed ) {
            return this.set( 'hasChanges', true );
        }
        return this.set( 'hasChanges', false );
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
        if ( this.get( 'isCommitting' ) ) {
            return;
        }
        this.set( 'isCommitting', true );

        this.fire( 'willCommit' );
        const {
            _created, _destroyed, _skToData, _skToStatus, _skToType,
            _typeToSkToId, _skToChanged, _skToCommitted, _skToRollback,
            _typeToClientState, _typeToStatus,
        } = this;

        const newSkToChanged = {};
        const newDestroyed = {};
        const changes = {};
        const types = {};
        let hasChanges = false;

        const getEntry = function ( Type ) {
            const typeId = guid( Type );
            let idPropKey, idAttrKey;
            let entry = changes[ typeId ];
            if ( !entry ) {
                idPropKey = Type.primaryKey || 'id';
                idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
                entry = changes[ typeId ] = {
                    primaryKey: idAttrKey,
                    create: { storeKeys: [], records: [] },
                    update: { storeKeys: [], records: [], changes: [] },
                    destroy: { storeKeys: [], ids: [] },
                    state: _typeToClientState[ typeId ],
                };
                _typeToStatus[ typeId ] |= COMMITTING;
                types[ typeId ] = Type;
                hasChanges = true;
            }
            return entry;
        };

        for ( const storeKey in _created ) {
            const status = _skToStatus[ storeKey ];
            const Type = _skToType[ storeKey ];
            let data = _skToData[ storeKey ];

            data = convertForeignKeysToId( this, Type, data );

            const create = getEntry( Type ).create;
            create.storeKeys.push( storeKey );
            create.records.push( data );
            this.setStatus( storeKey, ( status & ~DIRTY ) | COMMITTING );
        }
        for ( const storeKey in _skToChanged ) {
            const status = _skToStatus[ storeKey ];
            const Type = _skToType[ storeKey ];
            let data = _skToData[ storeKey ];

            const changed = _skToChanged[ storeKey ];
            if ( status & COMMITTING ) {
                newSkToChanged[ storeKey ] = changed;
                continue;
            }
            _skToRollback[ storeKey ] = _skToCommitted[ storeKey ];
            delete _skToCommitted[ storeKey ];
            data = convertForeignKeysToId( this, Type, data );

            const update = getEntry( Type ).update;
            update.storeKeys.push( storeKey );
            update.records.push( data );
            update.changes.push( changed );
            this.setStatus( storeKey, ( status & ~DIRTY ) | COMMITTING );
        }
        for ( const storeKey in _destroyed ) {
            const status = _skToStatus[ storeKey ];
            const Type = _skToType[ storeKey ];
            const id = _typeToSkToId[ guid( Type ) ][ storeKey ];

            // This means it's new and committing, so wait for commit to finish
            // first.
            if ( status & NEW ) {
                newDestroyed[ storeKey ] = 1;
                continue;
            }

            const destroy = getEntry( Type ).destroy;
            destroy.storeKeys.push( storeKey );
            destroy.ids.push( id );
            this.setStatus( storeKey, ( status & ~DIRTY ) | COMMITTING );
        }

        this._skToChanged = newSkToChanged;
        this._created = {};
        this._destroyed = newDestroyed;

        if ( hasChanges ) {
            this.source.commitChanges( changes, function () {
                for ( const typeId in types ) {
                    _typeToStatus[ typeId ] &= ~COMMITTING;
                    this._checkServerStatus( types[ typeId ] );
                }
                this.set( 'isCommitting', false );
                if ( this.autoCommit &&
                        this.checkForChanges().get( 'hasChanges' ) ) {
                    this.commitChanges();
                }
            }.bind( this ) );
        } else {
            this.set( 'isCommitting', false );
        }

        mayHaveChanges( this );
        this.fire( 'didCommit' );
    }.queue( 'middle' ),

    /**
        Method: O.Store#discardChanges

        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the last known committed state.

        Returns:
            {O.Store} Returns self.
    */
    discardChanges () {
        const {
            _created, _destroyed, _skToChanged, _skToCommitted, _skToType,
            _skToData,
        } = this;

        for ( const storeKey in _created ) {
            this.destroyRecord( storeKey );
        }
        for ( const storeKey in _skToChanged ) {
            this.updateData( storeKey, _skToCommitted[ storeKey ], true );
        }
        for ( const storeKey in _destroyed ) {
            this.undestroyRecord(
                storeKey, _skToType[ storeKey ], _skToData[ storeKey ] );
        }

        this._created = {};
        this._destroyed = {};

        return this.set( 'hasChanges', false );
    },

    getInverseChanges () {
        const {
            _created, _destroyed, _skToType, _skToData, _skToChanged,
            _skToCommitted,
        } = this;
        const inverse = {
            create: [],
            update: [],
            destroy: [],
        };

        for ( const storeKey in _created ) {
            inverse.destroy.push( storeKey );
        }
        for ( const storeKey in _skToChanged ) {
            inverse.update.push([
                storeKey,
                Object.filter(
                    _skToCommitted[ storeKey ], _skToChanged[ storeKey ]
                ),
            ]);
        }
        for ( const storeKey in _destroyed ) {
            const Type = _skToType[ storeKey ];
            inverse.create.push([
                storeKey,
                Type,
                Object.filter(
                    clone( _skToData[ storeKey ] ),
                    Record.getClientSettableAttributes( Type )
                ),
            ]);
        }

        return inverse;
    },

    applyChanges ( changes ) {
        const create = changes.create;
        const update = changes.update;
        const destroy = changes.destroy;

        for ( let i = 0, l = create.length; i < l; i += 1 ) {
            const createObj = create[i];
            const storeKey = createObj[0];
            const Type = createObj[1];
            const data = createObj[2];
            this.undestroyRecord( storeKey, Type, data );
        }
        for ( let i = 0, l = update.length; i < l; i += 1 ) {
            const updateObj = update[i];
            const storeKey = updateObj[0];
            const data = updateObj[1];
            this.updateData( storeKey, data, true );
        }
        for ( let i = 0, l = destroy.length; i < l; i += 1 ) {
            const storeKey = destroy[i];
            this.destroyRecord( storeKey );
        }
    },

    // === Low level (primarily internal) API: uses storeKey ===================

    /**
        Method: O.Store#getTypeStatus

        Get the status of a type

        Parameters:
            Type - {O.Class} The record type.

        Returns:
            {O.Status} The status of the type in the store.
    */
    getTypeStatus ( Type ) {
        return this._typeToStatus[ guid( Type ) ] || EMPTY;
    },

    /**
        Method: O.Store#getTypeState

        Get the current client state token for a type.

        Parameters:
            Type - {O.Class} The record type.

        Returns:
            {String|null} The client's current state token for the type.
    */
    getTypeState ( Type ) {
        return this._typeToClientState[ guid( Type ) ] || null;
    },

    /**
        Method: O.Store#getStatus

        Get the status of a record with a given store key.

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Status} The status of the record with that store key.
    */
    getStatus ( storeKey ) {
        return this._skToStatus[ storeKey ] || EMPTY;
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
    setStatus ( storeKey, status ) {
        const previousStatus = this.getStatus( storeKey );
        const record = this._skToRecord[ storeKey ];
        if ( previousStatus !== status ) {
            this._skToStatus[ storeKey ] = status;
            // wasReady !== isReady
            if ( ( previousStatus ^ status ) & READY ) {
                this._recordDidChange( storeKey );
            }
            if ( record ) {
                record.propertyDidChange( 'status', previousStatus, status );
            }
            this._nestedStores.forEach( function ( store ) {
                store.parentDidChangeStatus( storeKey, previousStatus, status );
            });
        }
        return this;
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
    setRecordForStoreKey ( storeKey, record ) {
        this._skToRecord[ storeKey ] = record;
        return this;
    },

    /**
        Method: O.Store#materialiseRecord

        Returns the record object for a given store key, creating it if this is
        the first time it has been requested.

        Parameters:
            storeKey - {String} The store key of the record.
            Type     - {O.Class} The record type.

        Returns:
            {O.Record} Returns the requested record.
    */
    materialiseRecord ( storeKey, Type ) {
        return this._skToRecord[ storeKey ] ||
            ( this._skToRecord[ storeKey ] = new Type( this, storeKey ) );
    },

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
    mayUnloadRecord ( storeKey ) {
        const record = this._skToRecord[ storeKey ];
        const status = this.getStatus( storeKey );
        // Only unload unwatched clean, non-committing records.
        if ( ( status & (COMMITTING|NEW|DIRTY) ) ||
                ( ( status & READY ) && record && record.hasObservers() ) ) {
            return false;
        }
        return this._nestedStores.every( function ( store ) {
            return store.mayUnloadRecord( storeKey );
        });
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
    willUnloadRecord ( storeKey ) {
        const record = this._skToRecord[ storeKey ];
        if ( record ) {
            record.storeWillUnload();
        }
        this._nestedStores.forEach( function ( store ) {
            store.willUnloadRecord( storeKey );
        });
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
    unloadRecord ( storeKey ) {
        if ( !this.mayUnloadRecord( storeKey ) ) {
            return false;
        }
        this.willUnloadRecord( storeKey );

        delete this._skToLastAccess[ storeKey ];
        delete this._skToRecord[ storeKey ];
        delete this._skToRollback[ storeKey ];
        delete this._skToData[ storeKey ];
        delete this._skToStatus[ storeKey ];

        // Can't delete id/sk mapping without checking if we have any other
        // references to this key elsewhere (as either a foreign key or in a
        // remote query). For now just always keep.
        // const typeId = guid( this._skToType[ storeKey ] );
        // const id = this._typeToSkToId[ typeId ][ storeKey ];
        // delete this._skToType[ storeKey ];
        // delete this._typeToSkToId[ typeId ][ storeKey ];
        // if ( id ) {
        //     delete this._typeToIdToSk[ typeId ][ id ];
        // }

        return true;
    },

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
    createRecord ( storeKey, data ) {
        const status = this.getStatus( storeKey );
        if ( status !== EMPTY && status !== DESTROYED ) {
            RunLoop.didError({
                name: CANNOT_CREATE_EXISTING_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                        ( Object.keyOf( Status, status ) || status ) +
                    '\nData: ' + JSON.stringify( data ),
            });
            return this;
        }

        this._created[ storeKey ] = 1;
        this._skToData[ storeKey ] = data || {};

        this.setStatus( storeKey, (READY|NEW|DIRTY) );

        if ( this.autoCommit ) {
            this.commitChanges();
        }

        return this.set( 'hasChanges', true );
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
    destroyRecord ( storeKey ) {
        const status = this.getStatus( storeKey );
        // If created -> just remove from created.
        if ( status === (READY|NEW|DIRTY) ) {
            delete this._created[ storeKey ];
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
        } else if ( status & READY ) {
            // Discard changes if dirty.
            if ( status & DIRTY ) {
                this.setData( storeKey, this._skToCommitted[ storeKey ] );
                delete this._skToCommitted[ storeKey ];
                delete this._skToChanged[ storeKey ];
                if ( this.isNested ) {
                    delete this._skToData[ storeKey ];
                }
            }
            this._destroyed[ storeKey ] = 1;
            // Maintain COMMITTING flag so we know to wait for that to finish
            // before committing the destroy.
            // Maintain NEW flag as we have to wait for commit to finish (so we
            // have an id) before we can destroy it.
            // Maintain OBSOLETE flag in case we have to roll back.
            this.setStatus( storeKey,
                DESTROYED|DIRTY|( status & (COMMITTING|NEW|OBSOLETE) ) );
            if ( this.autoCommit ) {
                this.commitChanges();
            }
        }
        return mayHaveChanges( this );
    },

    undestroyRecord ( storeKey, Type, data ) {
        const status = this.getStatus( storeKey );
        if ( status === EMPTY || status === DESTROYED ) {
            const idPropKey = Type.primaryKey || 'id';
            const idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
            delete data[ idAttrKey ];
            this._skToType[ storeKey ] = Type;
            this.createRecord( storeKey, data );
        } else if ( ( status & ~(OBSOLETE|LOADING) ) ===
                (DESTROYED|COMMITTING) ) {
            this.setStatus( storeKey, READY|NEW|COMMITTING );
        } else if ( status & DESTROYED ) {
            delete this._destroyed[ storeKey ];
            this.setStatus( storeKey, ( status & ~(DESTROYED|DIRTY) ) | READY );
        }
        return mayHaveChanges( this );
    },

    // ---

    /**
        Method: O.Store#sourceStateDidChange

        Call this method to notify the store of a change in the state of a
        particular record type in the source. The store will wait for any
        loading or committing of this type to finish, then check its state. If
        it doesn't match, it will then request updates.

        Parameters:
            Type     - {O.Class} The record type.
            newState - {String} The new state on the server.

        Returns:
            {O.Store} Returns self.
    */
    sourceStateDidChange ( Type, newState ) {
        const typeId = guid( Type );
        const clientState = this._typeToClientState[ typeId ];
        const { _remoteQueries } = this;
        let l = _remoteQueries.length;

        if ( clientState && newState !== clientState ) {
            if ( !( this._typeToStatus[ typeId ] & (LOADING|COMMITTING) ) ) {
                while ( l-- ) {
                    const remoteQuery = _remoteQueries[l];
                    if ( remoteQuery.get( 'Type' ) === Type ) {
                        remoteQuery.setObsolete();
                    }
                }
                this.fetchAll( Type, true );
            } else {
                this._typeToServerState[ typeId ] = newState;
            }
        }

        return this;
    },

    /**
        Method (private): O.Store#_checkServerStatus

        Called internally when a type finishes loading or committing, to check
        if there's a server state update to process.

        Parameters:
            Type - {O.Class} The record type.
    */
    _checkServerStatus ( Type ) {
        const typeId = guid( Type );
        const serverState = this._typeToServerState[ typeId ];
        if ( serverState ) {
            delete this._typeToServerState[ typeId ];
            this.sourceStateDidChange( Type, serverState );
        }
    },

    /**
        Method: O.Store#fetchAll

        Fetches all records of a given type from the server, or if already
        fetched updates the set of records.

        Parameters:
            Type  - {O.Class} The type of records to fetch.
            force - {Boolean} (optional) Fetch even if we have a state string.

        Returns:
            {O.Store} Returns self.
    */
    fetchAll ( Type, force ) {
        const typeId = guid( Type );
        const status = this._typeToStatus[ typeId ];
        const state = this._typeToClientState[ typeId ];

        if ( !( status & LOADING ) && ( !state || force ) ) {
            this.source.fetchAllRecords( Type, state, function () {
                this._typeToStatus[ typeId ] &= ~LOADING;
                this._checkServerStatus( Type );
            }.bind( this ));
            this._typeToStatus[ typeId ] = ( status | LOADING );
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
    fetchData ( storeKey ) {
        const status = this.getStatus( storeKey );
        // Nothing to do if already loading or new, destroyed or non-existent.
        if ( status & (LOADING|NEW|DESTROYED|NON_EXISTENT) ) {
            return this;
        }
        const Type = this._skToType[ storeKey ];
        if ( !Type ) {
            return this;
        }
        const typeId = guid( Type );
        const id = this._typeToSkToId[ typeId ][ storeKey ];
        if ( status & EMPTY ) {
            this.source.fetchRecord( Type, id );
            this.setStatus( storeKey, (EMPTY|LOADING) );
        } else {
            this.source.refreshRecord( Type, id );
            this.setStatus( storeKey, ( status & ~OBSOLETE ) | LOADING );
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
    getData ( storeKey ) {
        return this._skToData[ storeKey ];
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
    setData ( storeKey, data ) {
        if ( this.getStatus( storeKey ) & READY ) {
            this.updateData( storeKey, data, false );
        } else {
            const changedKeys = Object.keys( data );
            this._skToData[ storeKey ] = data;
            this._notifyRecordOfChanges( storeKey, changedKeys );
            this._nestedStores.forEach( function ( store ) {
                store.parentDidSetData( storeKey, changedKeys );
            });
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
            changeIsDirty - {Boolean} Should the change be committed back to the
                            server?

        Returns:
            {Boolean} Was the data actually written? Will be false if the
            changeIsDirty flag is set but the current data is not yet loaded
            into memory.
    */
    updateData ( storeKey, data, changeIsDirty ) {
        const status = this.getStatus( storeKey );
        const { _skToData, _skToCommitted, _skToChanged } = this;
        let current = _skToData[ storeKey ];
        const changedKeys = [];
        let seenChange = false;

        if ( !current || ( changeIsDirty && !( status & READY ) ) ) {
            RunLoop.didError({
                name: CANNOT_WRITE_TO_UNREADY_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                        ( Object.keyOf( Status, status ) || status ) +
                    '\nData: ' + JSON.stringify( data ),
            });
            return false;
        }

        // Copy-on-write for nested stores.
        if ( this.isNested && !_skToData.hasOwnProperty( storeKey ) ) {
            _skToData[ storeKey ] = current = clone( current );
        }

        if ( changeIsDirty && status !== (READY|NEW|DIRTY) ) {
            const committed = _skToCommitted[ storeKey ] ||
                ( _skToCommitted[ storeKey ] = clone( current ) );
            const changed = _skToChanged[ storeKey ] ||
                ( _skToChanged[ storeKey ] = {} );

            for ( const key in data ) {
                const value = data[ key ];
                const oldValue = current[ key ];
                if ( !isEqual( value, oldValue ) ) {
                    current[ key ] = value;
                    changedKeys.push( key );
                    changed[ key ] = !isEqual( value, committed[ key ] );
                    seenChange = seenChange || changed[ key ];
                }
            }
            // If we just reset properties to their committed values, we should
            // check to see if there are any changes remaining.
            if ( !seenChange ) {
                for ( const key in changed ) {
                    if ( changed[ key ] ) {
                        seenChange = true;
                        break;
                    }
                }
            }
            // If there are still changes remaining, set the DIRTY flag and
            // commit. Otherwise, remove the DIRTY flag and reset state.
            if ( seenChange ) {
                this.setStatus( storeKey, status | DIRTY );
                if ( this.autoCommit ) {
                    this.commitChanges();
                }
            } else {
                this.setStatus( storeKey, status & ~DIRTY );
                delete _skToCommitted[ storeKey ];
                delete _skToChanged[ storeKey ];
                if ( this.isNested ) {
                    delete _skToData[ storeKey ];
                }
            }
            mayHaveChanges( this );
        } else {
            for ( const key in data ) {
                const value = data[ key ];
                const oldValue = current[ key ];
                if ( !isEqual( value, oldValue ) ) {
                    current[ key ] = value;
                    changedKeys.push( key );
                }
            }
        }

        this._notifyRecordOfChanges( storeKey, changedKeys );
        this._nestedStores.forEach( function ( store ) {
            store.parentDidUpdateData( storeKey, changedKeys );
        });
        this._recordDidChange( storeKey );
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
    revertData ( storeKey ) {
        const committed = this._skToCommitted[ storeKey ];
        if ( committed ) {
            this.updateData( storeKey, committed, true );
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
    _notifyRecordOfChanges ( storeKey, changedKeys ) {
        const record = this._skToRecord[ storeKey ];
        if ( record ) {
            let errorForAttribute;
            const attrs = meta( record ).attrs;
            record.beginPropertyChanges();
            let l = changedKeys.length;
            while ( l-- ) {
                const attrKey = changedKeys[l];
                let propKey = attrs[ attrKey ];
                // Server may return more data than is defined in the record;
                // ignore the rest.
                if ( !propKey ) {
                    // Special case: implicit id attribute
                    if ( attrKey === 'id' ) {
                        propKey = attrKey;
                    } else {
                        continue;
                    }
                }
                const attribute = record[ propKey ];
                record.computedPropertyDidChange( propKey );
                if ( attribute.validate ) {
                    if ( !errorForAttribute ) {
                        errorForAttribute = record.get( 'errorForAttribute' );
                    }
                    errorForAttribute.set( propKey, attribute.validate(
                        record.get( propKey ), propKey, record )
                    );
                }
            }
            record.endPropertyChanges();
        }
        return this;
    },

    // === Source callbacks ====================================================

    /**
        Method: O.Store#sourceDidFetchRecords

        Callback made by the <O.Source> object associated with this store when
        it fetches some records from the server.

        Parameters:
            Type    - {O.Class} The record type.
            records - {Object[]} Array of data objects.
            state   - {String} (optional) The state of the record type on the
                      server.
            isAll   - {Boolean} This is all the records of this type on the
                      server.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchRecords ( Type, records, state, isAll ) {
        const typeId = guid( Type );
        const { _typeToClientState } = this;
        let l = records.length;
        const idPropKey = Type.primaryKey || 'id';
        const idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
        const now = Date.now();
        const seen = {};
        const updates = {};
        const foreignRefAttrs = getForeignRefAttrs( Type );

        while ( l-- ) {
            const data = records[l];
            const id = data[ idAttrKey ];
            seen[ id ] = true;
            const storeKey = this.getStoreKey( Type, id );
            const status = this.getStatus( storeKey );

            if ( foreignRefAttrs.length ) {
                convertForeignKeysToSK( this, foreignRefAttrs, data );
            }

            // If we already have the record loaded, process it as an update.
            if ( status & READY ) {
                updates[ id ] = data;
            }
            // We're in the middle of destroying it. Update the data in case
            // we need to roll back.
            else if ( ( status & DESTROYED ) &&
                    ( status & (DIRTY|COMMITTING) ) ) {
                this._skToData[ storeKey ] = data;
                this.setStatus( storeKey, status & ~LOADING );
            }
            // Anything else is new.
            else {
                if ( !( status & EMPTY ) ) {
                    // Record was destroyed or non-existent, but has now been
                    // created (again). Set status back to empty so setData
                    // works.
                    this.setStatus( storeKey, EMPTY );
                }
                this.setData( storeKey, data );
                this.setStatus( storeKey, READY );
                this._skToLastAccess[ storeKey ] = now;
            }
        }

        if ( isAll ) {
            const _idToSk = this._typeToIdToSk[ guid( Type ) ];
            const destroyed = [];
            for ( const id in _idToSk ) {
                if ( !seen[ id ] &&
                        ( this.getStatus( _idToSk[ id ] ) & READY ) ) {
                    destroyed.push( id );
                }
            }
            if ( destroyed.length ) {
                this.sourceDidDestroyRecords( Type, destroyed );
            }
        }

        this.sourceDidFetchPartialRecords( Type, updates, true );

        if ( state ) {
            const oldState = _typeToClientState[ typeId ];
            // If the state has changed, we need to fetch updates, but we can
            // still load these records
            if ( !isAll && oldState && oldState !== state ) {
                this.sourceStateDidChange( Type, state );
            } else {
                _typeToClientState[ typeId ] = state;
            }
        }
        this._typeToStatus[ typeId ] |= READY;

        RunLoop.queueFn( 'middle',
            this.liveQueriesAreReady.bind( this, Type ) );

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
            Type    - {O.Class} The record type.
            updates - {Object} An object mapping record id to an object of
                      changed attributes.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchPartialRecords ( Type, updates, _idsAreSKs ) {
        const typeId = guid( Type );
        const { _skToData, _skToStatus, _skToChanged, _skToCommitted } = this;
        const _idToSk = this._typeToIdToSk[ typeId ] || {};
        const _skToId = this._typeToSkToId[ typeId ] || {};
        const idPropKey = Type.primaryKey || 'id';
        const idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
        const foreignRefAttrs = _idsAreSKs ? [] : getForeignRefAttrs( Type );

        for ( const id in updates ) {
            const storeKey = _idToSk[ id ];
            const status = _skToStatus[ storeKey ];
            let update = updates[ id ];

            // Skip if no update to process
            // Also can't update an empty or destroyed record.
            if ( !update || !( status & READY ) ) {
                continue;
            }

            // If OBSOLETE, the record may have changed since the fetch was
            // initiated. Since we don't want to overwrite any preemptive
            // changes, ignore this data and fetch it again.
            // Similarly if the record is committing, we don't know for sure
            // what state the update was applied on top of, so fetch again
            // to be sure.
            if ( status & (COMMITTING|OBSOLETE) ) {
                this.setStatus( storeKey, status & ~LOADING );
                this.fetchData( storeKey );
                continue;
            }

            if ( foreignRefAttrs.length ) {
                convertForeignKeysToSK( this, foreignRefAttrs, update );
            }

            if ( status & DIRTY ) {
                // If we have a conflict we can either rebase on top, or discard
                // our local changes.
                update = Object.assign( _skToCommitted[ storeKey ], update );
                if ( this.rebaseConflicts ) {
                    const oldData = _skToData[ storeKey ];
                    const oldChanged = _skToChanged[ storeKey ];
                    const newData = {};
                    const newChanged = {};
                    let clean = true;
                    // Every key in here must be reapplied on top, even if
                    // changed[key] === false, as this means it's been
                    // changed then changed back.
                    for ( const key in oldData ) {
                        if ( key in oldChanged ) {
                            if ( !isEqual( oldData[ key ], update[ key ] ) ) {
                                newChanged[ key ] = true;
                                clean = false;
                            }
                            newData[ key ] = oldData[ key ];
                        } else {
                            newData[ key ] = update[ key ];
                        }
                    }
                    if ( !clean ) {
                        _skToChanged[ storeKey ] = newChanged;
                        _skToCommitted[ storeKey ] = update;
                        this.setData( storeKey, newData );
                        this.setStatus( storeKey, (READY|DIRTY) );
                        continue;
                    }
                }
                delete _skToChanged[ storeKey ];
                delete _skToCommitted[ storeKey ];
            }

            const newId = update[ idAttrKey ];
            if ( newId && newId !== id ) {
                _skToId[ storeKey ] = newId;
                delete _idToSk[ id ];
                _idToSk[ newId ] = storeKey;
            }

            this.updateData( storeKey, update, false );
            this.setStatus( storeKey, READY );
        }
        return mayHaveChanges( this );
    },

    /**
        Method: O.Store#sourceCouldNotFindRecords

        Callback made by the <O.Source> object associated with this store when
        it has been asked to fetch certain record ids and the server has
        responded that the records do not exist.

        Parameters:
            Type   - {O.Class} The record type.
            idList - {String[]} The list of ids of non-existent requested
                     records.

        Returns:
            {O.Store} Returns self.
    */
    sourceCouldNotFindRecords ( Type, idList ) {
        let l = idList.length;
        const { _skToCommitted, _skToChanged } = this;

        while ( l-- ) {
            const storeKey = this.getStoreKey( Type, idList[l] );
            const status = this.getStatus( storeKey );
            if ( status & EMPTY ) {
                this.setStatus( storeKey, NON_EXISTENT );
            } else {
                if ( status & DIRTY ) {
                    this.setData( storeKey, _skToCommitted[ storeKey ] );
                    delete _skToCommitted[ storeKey ];
                    delete _skToChanged[ storeKey ];
                }
                this.setStatus( storeKey, DESTROYED );
                this.unloadRecord( storeKey );
            }
        }
        return mayHaveChanges( this );
    },

    // ---

    /**
        Method: O.Store#sourceDidFetchUpdates

        Callback made by the <O.Source> object associated with this store when
        it fetches the ids of all records of a particular type that have been
        created/modified/destroyed of a particular since the client's state.

        Parameters:
            Type     - {O.Class} The record type.
            changed  - {String[]} List of ids for records which have been
                       added or changed in the store since oldState.
            removed  - {String[]} List of ids for records which have been
                       destroyed in the store since oldState.
            oldState - {String} The state these changes are from.
            newState - {String} The state these changes are to.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchUpdates ( Type, changed, removed, oldState,
            newState ) {
        const typeId = guid( Type );
        if ( this._typeToClientState[ typeId ] === oldState ) {
            if ( changed ) {
                this.sourceDidModifyRecords( Type, changed );
            }
            if ( removed ) {
                this.sourceDidDestroyRecords( Type, removed );
            }
            this._typeToClientState[ typeId ] = newState;
        } else {
            this.sourceStateDidChange( Type, newState );
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidModifyRecords

        Callback made by the <O.Source> object associated with this store when
        some records may be out of date.

        Parameters:
            Type   - {O.Class} The record type.
            idList - {String[]} Array of record ids for records of the
                     given type which have updates available on the server.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidModifyRecords ( Type, idList ) {
        const { _skToStatus } = this;
        const _idToSk = this._typeToIdToSk[ guid( Type ) ] || {};
        let l = idList.length;

        while ( l-- ) {
            const storeKey = _idToSk[ idList[l] ];
            const status = _skToStatus[ storeKey ];
            if ( status & READY ) {
                this.setStatus( storeKey, status | OBSOLETE );
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
            Type   - {O.Class} The record type.
            idList - {String[]} The list of ids of records which have been
                     destroyed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidDestroyRecords ( Type, idList ) {
        let l = idList.length,
            storeKey;

        while ( l-- ) {
            storeKey = this.getStoreKey( Type, idList[l] );
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
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
            Type     - {O.Class} The record type.
            oldState - {String} The state before the commit.
            newState - {String} The state after the commit.

        Returns:
            {O.Store} Returns self.
    */
    sourceCommitDidChangeState ( Type, oldState, newState ) {
        const typeId = guid( Type );
        const { _typeToClientState } = this;

        if ( _typeToClientState[ typeId ] === oldState ) {
            _typeToClientState[ typeId ] = newState;
        } else {
            delete this._typeToServerState[ typeId ];
            this.sourceStateDidChange( Type, newState );
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
    sourceDidCommitCreate ( skToPartialData ) {
        const { _skToType, _typeToSkToId, _typeToIdToSk } = this;
        for ( const storeKey in skToPartialData ) {
            const status = this.getStatus( storeKey );
            if ( status & NEW ) {
                const data = skToPartialData[ storeKey ];

                const Type = _skToType[ storeKey ];
                const typeId = guid( Type );
                const idPropKey = Type.primaryKey || 'id';
                const idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
                const id = data[ idAttrKey ];

                // Set id internally
                _typeToSkToId[ typeId ][ storeKey ] = id;
                _typeToIdToSk[ typeId ][ id ] = storeKey;

                const foreignRefAttrs = getForeignRefAttrs( Type );
                if ( foreignRefAttrs.length ) {
                    convertForeignKeysToSK( this, foreignRefAttrs, data );
                }

                // Notify record, and update with any other data
                this.updateData( storeKey, data, false );
                this.setStatus( storeKey, status & ~(COMMITTING|NEW) );
            } else {
                RunLoop.didError({
                    name: SOURCE_COMMIT_CREATE_MISMATCH_ERROR,
                });
            }
        }
        if ( this.autoCommit ) {
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
    sourceDidNotCreate ( storeKeys, isPermanent, errors ) {
        let l = storeKeys.length;
        const { _skToCommitted, _skToChanged, _created } = this;

        while ( l-- ) {
            const storeKey = storeKeys[l];
            const status = this.getStatus( storeKey );
            if ( status & DESTROYED ) {
                this.setStatus( storeKey, DESTROYED );
                this.unloadRecord( storeKey );
            }
            else {
                if ( status & DIRTY ) {
                    delete _skToCommitted[ storeKey ];
                    delete _skToChanged[ storeKey ];
                }
                this.setStatus( storeKey, (READY|NEW|DIRTY) );
                _created[ storeKey ] = 1;
                if ( isPermanent && errors &&
                        !this._notifyRecordOfError( storeKey, errors[l] ) ) {
                    this.destroyRecord( storeKey );
                }
            }
        }
        if ( this.autoCommit ) {
            this.commitChanges();
        }
        return mayHaveChanges( this );
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
    sourceDidCommitUpdate ( storeKeys ) {
        let l = storeKeys.length;
        const { _skToRollback } = this;

        while ( l-- ) {
            const storeKey = storeKeys[l];
            const status = this.getStatus( storeKey );
            delete _skToRollback[ storeKey ];
            if ( status !== EMPTY ) {
                this.setStatus( storeKey, status & ~COMMITTING );
            }
        }
        if ( this.autoCommit ) {
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
    sourceDidNotUpdate ( storeKeys, isPermanent, errors ) {
        let l = storeKeys.length;
        const { _skToData, _skToChanged, _skToCommitted, _skToRollback } = this;

        while ( l-- ) {
            const storeKey = storeKeys[l];
            const status = this.getStatus( storeKey );
            // If destroyed now, but still in memory, revert the data so
            // that if the destroy fails we still have the right data.
            if ( ( status & DESTROYED ) && _skToRollback[ storeKey ] ) {
                _skToData[ storeKey ] = _skToRollback[ storeKey ];
                delete _skToRollback[ storeKey ];
            }
            // Other than that, we don't care about unready records
            if ( !( status & READY ) ) {
                // But make sure we know it's no longer committing.
                if ( status !== EMPTY ) {
                    this.setStatus( storeKey, status & ~COMMITTING );
                }
                continue;
            }
            const committed = _skToCommitted[ storeKey ] =
                _skToRollback[ storeKey ];
            delete _skToRollback[ storeKey ];
            const changed = {};
            const current = _skToData[ storeKey ];
            delete _skToChanged[ storeKey ];
            for ( const key in current ) {
                if ( !isEqual( current[ key ], committed[ key ] ) ) {
                    changed[ key ] = true;
                    _skToChanged[ storeKey ] = changed;
                }
            }
            if ( _skToChanged[ storeKey ] ) {
                this.setStatus( storeKey, ( status & ~COMMITTING )|DIRTY );
            } else {
                this.setStatus( storeKey, ( status & ~COMMITTING ) );
            }
            if ( isPermanent && errors &&
                    !this._notifyRecordOfError( storeKey, errors[l] ) ) {
                this.revertData( storeKey );
            }
        }
        if ( this.autoCommit ) {
            this.commitChanges();
        }
        return mayHaveChanges( this );
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
    sourceDidCommitDestroy ( storeKeys ) {
        let l = storeKeys.length,
            storeKey, status;
        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            // If the record has been undestroyed while being committed
            // it will no longer be in the destroyed state, but instead be
            // READY|NEW|COMMITTING.
            if ( ( status & ~DIRTY ) === (READY|NEW|COMMITTING) ) {
                if ( status & DIRTY ) {
                    delete this._skToCommitted[ storeKey ];
                    delete this._skToChanged[ storeKey ];
                }
                this.setStatus( storeKey, (READY|NEW|DIRTY) );
                this._created[ storeKey ] = 1;
            } else if ( status & DESTROYED ) {
                this.setStatus( storeKey, DESTROYED );
                this.unloadRecord( storeKey );
            } else {
                RunLoop.didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR,
                });
            }
        }
        if ( this.autoCommit ) {
            this.commitChanges();
        }
        return mayHaveChanges( this );
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
    sourceDidNotDestroy ( storeKeys, isPermanent, errors ) {
        let l = storeKeys.length;
        const { _destroyed } = this;

        while ( l-- ) {
            const storeKey = storeKeys[l];
            const status = this.getStatus( storeKey );
            if ( ( status & ~DIRTY ) === (READY|NEW|COMMITTING) ) {
                this.setStatus( storeKey, status & ~(COMMITTING|NEW) );
            } else if ( status & DESTROYED ) {
                this.setStatus( storeKey, ( status & ~COMMITTING )|DIRTY );
                _destroyed[ storeKey ] = 1;
                if ( isPermanent && errors &&
                        !this._notifyRecordOfError( storeKey, errors[l] ) ) {
                    this.undestroyRecord( storeKey );
                }
            } else {
                RunLoop.didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR,
                });
            }
        }
        if ( this.autoCommit ) {
            this.commitChanges();
        }
        return mayHaveChanges( this );
    },

    _notifyRecordOfError ( storeKey, error ) {
        const record = this._skToRecord[ storeKey ];
        let isDefaultPrevented = false;
        if ( record ) {
            const event = new Event( error.type || 'error', record, error );
            record.fire( 'record:commit:error', event );
            isDefaultPrevented = event.defaultPrevented;
        }
        this._nestedStores.forEach( function ( store ) {
            isDefaultPrevented =
                store._notifyRecordOfError( storeKey, error ) ||
                isDefaultPrevented;
        });
        return isDefaultPrevented;
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
    findAll ( Type, accept, compare ) {
        const _skToId = this._typeToSkToId[ guid( Type ) ] || {};
        const { _skToStatus } = this;
        let results = [];

        for ( const storeKey in _skToId ) {
            if ( _skToStatus[ storeKey ] & READY ) {
                results.push( storeKey );
            }
        }

        if ( accept ) {
            const filterFn = filter.bind( this, accept );
            results = results.filter( filterFn );
            results.filterFn = filterFn;
        }

        if ( compare ) {
            const sortFn = sort.bind( this, compare );
            results.sort( sortFn );
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
    findOne ( Type, accept ) {
        const _skToId = this._typeToSkToId[ guid( Type ) ] || {};
        const { _skToStatus } = this;
        const filterFn = accept && filter.bind( this, accept );

        for ( const storeKey in _skToId ) {
            if ( ( _skToStatus[ storeKey ] & READY ) &&
                    ( !filterFn || filterFn( storeKey ) ) ) {
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
            query - {(O.LiveQuery|O.RemoteQuery)}
                    The query object.

        Returns:
            {O.Store} Returns self.
    */
    addQuery ( query ) {
        const { source } = this;
        this._idToQuery[ query.get( 'id' ) ] = query;
        if ( query instanceof LiveQuery ) {
            const Type = query.get( 'Type' );
            const typeId = guid( Type );
            this.fetchAll( Type );
            ( this._liveQueries[ typeId ] ||
                ( this._liveQueries[ typeId ] = [] ) ).push( query );
        } else if ( query instanceof RemoteQuery ) {
            source.fetchQuery( query );
            this._remoteQueries.push( query );
        }
        return this;
    },

    /**
        Method: O.Store#removeQuery

        Deregisters a query with the store. This is automatically called when
        you call destroy() on a query. You should never need to call this
        manually.

        Parameters:
            query - {(O.LiveQuery|O.RemoteQuery)}
                    The query object.

        Returns:
            {O.Store} Returns self.
    */
    removeQuery ( query ) {
        delete this._idToQuery[ query.get( 'id' ) ];
        if ( query instanceof LiveQuery ) {
            const { _liveQueries } = this;
            const typeId = guid( query.get( 'Type' ) );
            const typeQueries = _liveQueries[ typeId ];
            if ( typeQueries.length > 1 ) {
                typeQueries.erase( query );
            } else {
                delete _liveQueries[ typeId ];
            }
        } else if ( query instanceof RemoteQuery ) {
            this._remoteQueries.erase( query );
        }
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
            mixin    - {(Object|null)} (optional) Properties to pass to the
                         QueryClass constructor.

        Returns:
            {(O.LiveQuery|O.RemoteQuery|null)} The requested query.
    */
    getQuery ( id, QueryClass, mixin ) {
        let query = ( id && this._idToQuery[ id ] ) || null;
        if ( !query && QueryClass ) {
            query = new QueryClass( Object.assign( mixin || {}, {
                id,
                store: this,
                source: this.source,
            }) );
        }
        if ( query ) {
            query.lastAccess = Date.now();
        }
        return query;
    },

    /**
        Method: O.Store#getAllRemoteQueries

        Returns a list of all remote queries registered with the store.

        Returns:
            {O.RemoteQuery[]} A list of all registered instances of
            <O.RemoteQuery>.
    */
    getAllRemoteQueries () {
        return this._remoteQueries;
    },

    /**
        Method (protected): O.Store#_recordDidChange

        Registers a record has changed in a way that might affect any live
        queries on that type.

        Parameters:
            storeKey - {String} The store key of the record.
    */
    _recordDidChange ( storeKey ) {
        const typeId = guid( this._skToType[ storeKey ] );
        const { _typeToChangedSks } = this;
        const changedSks = _typeToChangedSks[ typeId ] ||
                ( _typeToChangedSks[ typeId ] = {} );
        changedSks[ storeKey ] = true;
        RunLoop.queueFn( 'middle', this.refreshLiveQueries, this );
    },

    /**
        Method: O.Store#refreshLiveQueries

        Refreshes the contents of all registered instances of <O.LiveQuery>
        which may have changes. This is automatically called when necessary by
        the store; you should rarely need to call this manually.

        Returns:
            {O.Store} Returns self.
    */
    refreshLiveQueries () {
        const { _typeToChangedSks, _liveQueries } = this;

        this._typeToChangedSks = {};

        for ( const typeId in _typeToChangedSks ) {
            const typeChanges = Object.keys( _typeToChangedSks[ typeId ] );
            const typeQueries = _liveQueries[ typeId ];
            let l = typeQueries ? typeQueries.length : 0;

            while ( l-- ) {
                typeQueries[l].storeDidChangeRecords( typeChanges );
            }
            this.fire( typeId, {
                storeKeys: typeChanges,
            });
        }

        return this;
    },

    liveQueriesAreReady ( Type ) {
        const _liveQueries = this._liveQueries[ guid( Type ) ];
        let l = _liveQueries ? _liveQueries.length : 0;
        while ( l-- ) {
            _liveQueries[l].set( 'status', READY );
        }
    },
});

[ 'on', 'once', 'off' ].forEach( function ( property ) {
    Store.prototype[ property ] = function ( type, obj, method ) {
        if ( typeof type !== 'string' ) {
            type = guid( type );
        }
        return EventTarget[ property ].call( this, type, obj, method );
    };
});

export default Store;
