// -------------------------------------------------------------------------- \\
// File: Store.js                                                             \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Record.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

/**
    Module: DataStore

    The DataStore module provides classes for managing the CRUD lifecycle of
    data records.
*/

( function ( NS ) {

// Same as O.Status, inlined here for efficiency:
// Core states:
var EMPTY        =   1;
var READY        =   2;
var DESTROYED    =   4;
var NON_EXISTENT =   8;
// Properties
var LOADING      =  16; // Request in progress to fetch record or updates
var COMMITTING   =  32; // Request in progress to commit record
var NEW          =  64; // Record is not created on source (has no source id)
var DIRTY        = 128; // Record has local changes not yet committing
var OBSOLETE     = 256; // Record may have changes not yet requested

// Error messages.
var Status = NS.Status;
var CANNOT_CREATE_EXISTING_RECORD_ERROR =
        'O.Store Error: Cannot create existing record',
    CANNOT_WRITE_TO_UNREADY_RECORD_ERROR =
        'O.Store Error: Cannot write to unready record',
    FETCHED_IS_DESTROYED_OR_NON_EXISTENT_ERROR =
        'O.Store Error: Record loaded which has status destroyed or non-existent',
    SOURCE_COMMIT_CREATE_MISMATCH_ERROR =
        'O.Store Error: Source committed a create on a record not marked new',
    SOURCE_COMMIT_DESTROY_MISMATCH_ERROR =
        'O.Store Error: Source commited a destroy on a record not marked destroyed',
    SOURCE_COMMIT_ON_UNKNOWN_STATE  =
        'O.Store Error: Source committed on unknown state';

var guid = NS.guid;

var sk = 1;
var generateStoreKey = function () {
    return 'k' + ( sk++ );
};

var set = function ( status ) {
    return function ( storeKey ) {
        return this.setStatus(
            storeKey, this.getStatus( storeKey ) | status );
    };
};

var filter = function ( accept, storeKey ) {
    return accept( this._skToData[ storeKey ], this, storeKey );
};
var sort = function ( compare, a, b ) {
    var _skToData = this._skToData,
        aIsFirst = compare( _skToData[ a ], _skToData[ b ], this );
    return aIsFirst || ( ~~a.slice( 1 ) - ~~b.slice( 1 ) );
};
var isEqual = NS.isEqual;

/**
    Class: O.Store

    A Store is used to keep track of all records in the model. It provides
    methods for retrieving single records or lists based on queries.
*/
var Store = NS.Class({

    Mixin: NS.EventTarget,

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
        Constructor: O.Store

        Parameters:
            source - {O.Source} The source for this store.
    */
    init: function ( mixin ) {
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

        // Set of store keys for created records
        this._created = {};
        // Set of store keys for destroyed records
        this._destroyed = {};

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

        // Waiting for an id
        this._awaitingId = {};

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

        this._commitCallbacks = [];

        NS.extend( this, mixin );

        mixin.source.set( 'store', this );
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
    addNested: function ( store ) {
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
    removeNested: function ( store ) {
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
    getStoreKey: function ( Type, id ) {
        var typeId = guid( Type ),
            ids = ( this._typeToIdToSk[ typeId ] ||
                ( this._typeToIdToSk[ typeId ] = {} ) ),
            storeKey = id && ids[ id ];

        if ( !storeKey ) {
            storeKey = generateStoreKey();
            this._skToType[ storeKey ] = Type;
            ( this._typeToSkToId[ typeId ] ||
                ( this._typeToSkToId[ typeId ] = {} ) )[ storeKey ] = id;
            if ( id ) {
                ids[ id ] = storeKey;
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
    getIdFromStoreKey: function ( storeKey ) {
        var Type = this._skToType[ storeKey ];
        return Type &&
            ( this._typeToSkToId[ guid( Type ) ] || {} )[ storeKey ];
    },

    /**
        Method: O.Store#setIdForStoreKey

        Changes the id for a record with the given store key.

        Parameters:
            storeKey - {String} The store key of the record.
            id       - {String} The new id for the record.

        Returns:
            {O.Store} Returns self.
    */
    setIdForStoreKey: function ( storeKey, id ) {
        var Type = this._skToType[ storeKey ],
            typeId = guid( Type ),
            idPropKey = Type.primaryKey || 'id',
            idAttrKey = Type.prototype[ idPropKey ].key || idPropKey,
            _skToId = this._typeToSkToId[ typeId ],
            _idToSk = this._typeToIdToSk[ typeId ],
            oldId = _skToId[ storeKey ],
            update = {};

        if ( id !== oldId ) {
            _skToId[ storeKey ] = id;
            if ( oldId ) {
                delete _idToSk[ oldId ];
            }
            _idToSk[ id ] = storeKey;

            // May have already been destroyed since it was created.
            if ( this.getStatus( storeKey ) & READY ) {
                update[ idAttrKey ] = id;
                this.updateData( storeKey, update, false );
                this.updateDataLinkedToId( storeKey, id );
            } else {
                // Update in case of discard changes.
                this._skToData[ storeKey ][ idAttrKey ] = id;
            }
        }

        return this;
    },

    /**
        Method: O.Store#attrMapsToStoreKey

        Called by a record when it sets a relationship to a record which does
        not yet have an id. When the id is set by the source, the store will
        then automatically update the data object with the id.

        Parameters:
            toStoreKey   - {String} The store key of the record without an id.
            fromStoreKey - {String} The store key of the record with the
                           relationship to the record in the first parameter.
            attrKey      - {String} The key for the attribute in which the
                           relationship is stored.

        Returns:
            {O.Store} Returns self.
    */
    attrMapsToStoreKey: function ( toStoreKey, fromStoreKey, attrKey ) {
        ( this._awaitingId[ toStoreKey ] ||
            ( this._awaitingId[ toStoreKey ] = [] )
        ).push([ fromStoreKey, attrKey ]);
        return this;
    },

    /**
        Method: O.Store#attrNoLongerMapsToStoreKey

        Called by a record when it removes a relationship to a record which does
        not yet have an id.

        Parameters:
            toStoreKey   - {String} The store key of the record without an id.
            fromStoreKey - {String} The store key of the record which had the
                           relationship to the record in the first parameter.
            attrKey      - {String} The key for the attribute in which the
                           relationship was stored.

        Returns:
            {O.Store} Returns self.
    */
    attrNoLongerMapsToStoreKey: function ( toStoreKey, fromStoreKey, attrKey ) {
        var waiting = this._awaitingId[ toStoreKey ],
            l = waiting ? waiting.length: 0,
            pair;

        while ( l-- ) {
            pair = waiting[l];
            if ( pair[0] === fromStoreKey && pair[1] === attrKey ) {
                waiting.splice( l, 1 );
                break;
            }
        }
    },

    /**
        Method: O.Store#updateDataLinkedToId

        Updates the data objects which have a relationship to a record which now
        has an id, replacing the store key with the actual id.

        Parameters:
            storeKey - {String} The store key of the record.
            id       - {String} The new id for the record.

        Returns:
            {O.Store} Returns self.
    */
    updateDataLinkedToId: function ( storeKey, id ) {
        var waiting = this._awaitingId[ storeKey ],
            _skToData = this._skToData,
            _skToCommitted = this._skToCommitted,
            l, storeKeyId, pair, data, value, fromStoreKey, attrKey, index;
        if ( waiting ) {
            delete this._awaitingId[ storeKey ];
            l = waiting.length;
            storeKeyId = '#' + storeKey;
            while ( l-- ) {
                pair = waiting[l];
                fromStoreKey = pair[0];
                attrKey = pair[1];
                data = _skToData[ fromStoreKey ];
                if ( data && ( value = data[ attrKey ] ) ) {
                    if ( value instanceof Array ) {
                        index = value.indexOf( storeKeyId );
                        if ( index > -1 ) {
                            value[ index ] = id;
                        }
                    } else if ( value === storeKeyId ) {
                        data[ attrKey ] = id;
                    }
                }
                data = _skToCommitted[ fromStoreKey ];
                if ( data && ( value = data[ attrKey ] ) ) {
                    if ( value instanceof Array ) {
                        index = value.indexOf( storeKeyId );
                        if ( index > -1 ) {
                            value[ index ] = id;
                        }
                    } else if ( value === storeKeyId ) {
                        data[ attrKey ] = id;
                    }
                }
            }
        }
        this._nestedStores.forEach( function ( store ) {
            store.updateDataLinkedToId( storeKey, id );
        });
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
    getRecordStatus: function ( Type, id ) {
        var _idToSk = this._typeToIdToSk[ guid( Type ) ];
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
    getRecord: function ( Type, id, doNotFetch ) {
        if ( !Type || !id ) { return null; }
        var storeKey = ( id.charAt( 0 ) === '#' ) ?
                id.slice( 1 ) : this.getStoreKey( Type, id ),
            record = this.materialiseRecord( storeKey, Type );

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
    getOne: function ( Type, filter ) {
        var storeKey = this.findOne( Type, filter );
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
    getAll: function ( Type, filter, sort ) {
        var storeKeys = this.findAll( Type, filter, sort );
        return new NS.RecordArray( this, Type, storeKeys );
    },

    /**
        Method: O.Store#hasChanges

        Returns:
            {Boolean} Are there any changes in the store?
    */
    hasChanges: function () {
        var storeKey;
        for ( storeKey in this._created ) {
            return true;
        }
        for ( storeKey in this._skToChanged ) {
            return true;
        }
        for ( storeKey in this._destroyed ) {
            return true;
        }
        return false;
    },

    /**
        Method: O.Store#commitChanges

        Commits any outstanding changes (created/updated/deleted records) to the
        source. Will only invoke once per run loop, even if called multiple
        times.

        Parameters:
            callback - {Function} (optional) A callback to be made after the
                       source has finished committing the changes.

        Returns:
            {O.Store} Returns self.
    */
    commitChanges: function ( callback ) {
        if ( callback ) {
            this._commitCallbacks.push( callback );
        }
        NS.RunLoop.queueFn( 'middle', this._commitChanges, this );
    },
    _commitChanges: function () {
        this.fire( 'willCommit' );
        var _created = this._created,
            _destroyed = this._destroyed,
            _skToData = this._skToData,
            _skToStatus = this._skToStatus,
            _skToType = this._skToType,
            _typeToSkToId = this._typeToSkToId,
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            _skToRollback = this._skToRollback,
            storeKey, data, changed, id, status, create, update, destroy,
            newSkToChanged = {},
            newDestroyed = {},
            changes = {},
            commitCallbacks = this._commitCallbacks,
            callback;

        var getEntry = function ( Type ) {
            var typeId = guid( Type ),
                idPropKey, idAttrKey,
                entry = changes[ typeId ];
            if ( !entry ) {
                idPropKey = Type.primaryKey || 'id';
                idAttrKey = Type.prototype[ idPropKey ].key || idPropKey;
                entry = changes[ typeId ] = {
                    primaryKey: idAttrKey,
                    create: { storeKeys: [], records: [] },
                    update: { storeKeys: [], records: [], changes: [] },
                    destroy: { storeKeys: [], ids: [] },
                    state: this._typeToClientState[ typeId ]
                };
                this._typeToStatus[ typeId ] |= COMMITTING;
            }
            return entry;
        }.bind( this );

        for ( storeKey in _created ) {
            data = _skToData[ storeKey ];
            create = getEntry( _skToType[ storeKey ] ).create;
            create.storeKeys.push( storeKey );
            create.records.push( data );
            this.setCommitting( storeKey );
        }
        for ( storeKey in _skToChanged ) {
            status = _skToStatus[ storeKey ];
            data = _skToData[ storeKey ];
            changed = _skToChanged[ storeKey ];
            if ( status & COMMITTING ) {
                newSkToChanged[ storeKey ] = changed;
                continue;
            }
            _skToRollback[ storeKey ] = _skToCommitted[ storeKey ];
            delete _skToCommitted[ storeKey ];
            update = getEntry( _skToType[ storeKey ] ).update;
            update.storeKeys.push( storeKey );
            update.records.push( data );
            update.changes.push( changed );
            this.setStatus( storeKey, ( status & ~DIRTY ) | COMMITTING );
        }
        for ( storeKey in _destroyed ) {
            id = _typeToSkToId[ guid( _skToType[ storeKey ] ) ][ storeKey ];
            // This means it's new and committing, so wait for commit to finish
            // first.
            if ( _skToStatus[ storeKey ] & NEW ) {
                newDestroyed[ storeKey ] = 1;
                continue;
            }
            destroy = getEntry( _skToType[ storeKey ] ).destroy;
            destroy.storeKeys.push( storeKey );
            destroy.ids.push( id );
            this.setStatus( storeKey, (DESTROYED|COMMITTING) );
        }

        this._skToChanged = newSkToChanged;
        this._created = {};
        this._destroyed = newDestroyed;

        if ( commitCallbacks.length ) {
            if ( commitCallbacks.length > 1 ) {
                callback = commitCallbacks.forEach.bind(
                    commitCallbacks, function ( fn ) { fn(); } );
                this._commitCallbacks = [];
            } else {
                callback = commitCallbacks.pop();
            }
        }

        this.source.commitChanges( changes, callback );

        return this.fire( 'didCommit' );
    },

    /**
        Method: O.Store#discardChanges

        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the last known committed state.

        Returns:
            {O.Store} Returns self.
    */
    discardChanges: function () {
        var _created = this._created,
            _destroyed = this._destroyed,
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            storeKey;

        for ( storeKey in _created ) {
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
        }
        for ( storeKey in _skToChanged ) {
            this.updateData( storeKey, _skToCommitted[ storeKey ], true );
        }
        for ( storeKey in _destroyed ) {
            this.setStatus( storeKey,
                READY|( this.getStatus( storeKey ) & OBSOLETE ) );
        }

        this._created = {};
        this._destroyed = {};

        return this;
    },

    getInverseChanges: function () {
        var _created = this._created,
            _destroyed = this._destroyed,
            _skToType = this._skToType,
            _skToData = this._skToData,
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            inverse = {
                create: [],
                update: [],
                destroy: []
            },
            storeKey;

        for ( storeKey in _created ) {
            inverse.destroy.push( storeKey );
        }
        for ( storeKey in _skToChanged ) {
            inverse.update.push([
                storeKey,
                Object.filter(
                    _skToCommitted[ storeKey ], _skToChanged[ storeKey ]
                )
            ]);
        }
        for ( storeKey in _destroyed ) {
            inverse.create.push([
                storeKey,
                _skToType[ storeKey ],
                NS.clone( _skToData[ storeKey ] )
            ]);
        }

        return inverse;
    },

    applyChanges: function ( changes ) {
        var create = changes.create,
            update = changes.update,
            destroy = changes.destroy,
            created = {},
            createObj, updateObj,
            i, l, storeKey;

        for ( i = 0, l = create.length; i < l; i += 1 ) {
            createObj = create[i];
            storeKey = this.getStoreKey( createObj[1] );
            created[ createObj[0] ] = storeKey;
            this.createRecord( storeKey, createObj[2] );
        }
        for ( i = 0, l = update.length; i < l; i += 1 ) {
            updateObj = update[i];
            this.updateData( updateObj[0], updateObj[1], true );
        }
        for ( i = 0, l = destroy.length; i < l; i += 1 ) {
            storeKey = destroy[i];
            this.destroyRecord( storeKey );
        }
        return created;
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
    getTypeStatus: function ( Type ) {
        return this._typeToStatus[ guid( Type ) ] || EMPTY;
    },

    /**
        Method: O.Store#getStatus

        Get the status of a record with a given store key.

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Status} The status of the record with that store key.
    */
    getStatus: function ( storeKey ) {
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
    setStatus: function ( storeKey, status ) {
        var previousStatus = this.getStatus( storeKey ),
            record = this._skToRecord[ storeKey ];
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
        Method: O.Store#setDirty

        Add the <O.Status.DIRTY> bit to the record status

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Store} Returns self.
    */
    setDirty: set( DIRTY ),

    /**
        Method: O.Store#setLoading

        Add the <O.Status.LOADING> bit to the record status

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Store} Returns self.
    */
    setLoading: set( LOADING ),

    /**
        Method: O.Store#setCommitting

        Add the <O.Status.COMMITTING> bit to the record status

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Store} Returns self.
    */
    setCommitting: set( COMMITTING ),

    /**
        Method: O.Store#setObsolete

        Add the <O.Status.OBSOLETE> bit to the record status

        Parameters:
            storeKey - {String} The store key of the record.

        Returns:
            {O.Store} Returns self.
    */
    setObsolete: set( OBSOLETE ),

    /**
        Method: O.Store#setRecordForStoreKey

        Sets the record instance for a store key.

        Parameters:
            storeKey - {String} The store key of the record.
            record   - {O.Record} The record.

        Returns:
            {O.Store} Returns self.
    */
    setRecordForStoreKey: function ( storeKey, record ) {
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
    materialiseRecord: function ( storeKey, Type ) {
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
    mayUnloadRecord: function ( storeKey ) {
        var record = this._skToRecord[ storeKey ],
            status = this.getStatus( storeKey );
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
    willUnloadRecord: function ( storeKey ) {
        var record = this._skToRecord[ storeKey ];
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
    unloadRecord: function ( storeKey ) {
        if ( !this.mayUnloadRecord( storeKey ) ) {
            return false;
        }
        this.willUnloadRecord( storeKey );

        var typeId = guid( this._skToType[ storeKey ] ),
            id = this._typeToSkToId[ typeId ][ storeKey ];

        delete this._skToRecord[ storeKey ];
        delete this._skToData[ storeKey ];
        delete this._skToStatus[ storeKey ];
        delete this._skToType[ storeKey ];
        delete this._typeToSkToId[ typeId ][ storeKey ];
        if ( id ) {
            delete this._typeToIdToSk[ typeId ][ id ];
        }
        delete this._skToLastAccess[ storeKey ];
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
    createRecord: function ( storeKey, data ) {
        var status = this.getStatus( storeKey );
        if ( status !== EMPTY && status !== DESTROYED ) {
            NS.RunLoop.didError({
                name: CANNOT_CREATE_EXISTING_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                        ( Object.keyOf( Status, status ) || status ) +
                    '\nData: ' + JSON.stringify( data )
            });
            return this;
        }

        this._created[ storeKey ] = 1;
        this._skToData[ storeKey ] = data || {};

        this.setStatus( storeKey, (READY|NEW) );

        if ( this.autoCommit ) {
            this.commitChanges();
        }

        return this;
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
    destroyRecord: function ( storeKey ) {
        var status = this.getStatus( storeKey );
        // If created -> just remove from created.
        if ( status === (READY|NEW) ) {
            delete this._created[ storeKey ];
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
        } else if ( status & READY ) {
            // Discard changes if dirty.
            if ( status & DIRTY ) {
                this.setData( storeKey, this._skToCommitted[ storeKey ] );
                delete this._skToCommitted[ storeKey ];
                delete this._skToChanged[ storeKey ];
            }
            this._destroyed[ storeKey ] = 1;
            // Maintain OBSOLETE flag in case we have to roll back.
            // Maintain NEW flag as we have to wait for commit to finish (so we
            // have an id) before we can destroy it.
            this.setStatus( storeKey,
                DESTROYED|DIRTY|( status & (OBSOLETE|NEW) ) );
            if ( this.autoCommit ) {
                this.commitChanges();
            }
        }
        return this;
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
    sourceStateDidChange: function ( Type, newState ) {
        var typeId = guid( Type ),
            clientState = this._typeToClientState[ typeId ],
            status = this._typeToStatus[ typeId ] || EMPTY,
            _remoteQueries = this._remoteQueries,
            l = _remoteQueries.length,
            remoteQuery;

        if ( newState !== clientState ) {
            if ( !( status & (LOADING|COMMITTING) ) ) {
                while ( l-- ) {
                    remoteQuery = _remoteQueries[l];
                    if ( remoteQuery.get( 'Type' ) === Type ) {
                        remoteQuery.setObsolete();
                    }
                }
                // If all records fetched for this type, refresh.
                if ( status & READY ) {
                    this.fetchAll( Type, true );
                }
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
    _checkServerStatus: function ( Type ) {
        var typeId = guid( Type ),
            serverState;
        if ( !( this._typeToStatus[ typeId ] & (LOADING|COMMITTING) ) ) {
            serverState = this._typeToServerState[ typeId ];
            if ( serverState ) {
                if ( serverState !== this._typeToServerState[ typeId ] ) {
                    this.fetchAll( Type, true );
                }
                delete this._typeToServerState[ typeId ];
            }
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
    fetchAll: function ( Type, force ) {
        var typeId = guid( Type ),
            status = this._typeToStatus[ typeId ],
            state = this._typeToClientState[ typeId ];

        if ( !( status & LOADING ) && ( !state || force ) ) {
            this.source.fetchAllRecords( Type, state );
            this._typeToStatus[ typeId ] = ( status | LOADING );
        }
        return this;
    },

    /**
        Method: O.Store#fetchData

        Fetches the data for a given record from the server.

        Parameters:
            storeKey - {String} The store key of the record to fetch.

        Returns:
            {O.Store} Returns self.
    */
    fetchData: function ( storeKey ) {
        var status = this.getStatus( storeKey );

        // Nothing to do if already loading or new, destroyed or non-existant.
        if ( status & (LOADING|NEW|DESTROYED|NON_EXISTENT) ) {
            return this;
        }
        var Type = this._skToType[ storeKey ],
            typeId = guid( Type ),
            id = this._typeToSkToId[ typeId ][ storeKey ];
        // Ignore if all data for type is loading.
        if ( this._typeToStatus[ typeId ] & LOADING ) {
            return this;
        }
        if ( status & EMPTY ) {
            this.source.fetchRecord( Type, id );
            this.setStatus( storeKey, (EMPTY|LOADING) );
        } else {
            this.source.refreshRecord( Type, id );
            this.setLoading( storeKey );
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
    getData: function ( storeKey ) {
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
    setData: function ( storeKey, data ) {
        if ( this.getStatus( storeKey ) & READY ) {
            this.updateData( storeKey, data, false );
        } else {
            var changedKeys = Object.keys( data );
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
    updateData: function ( storeKey, data, changeIsDirty ) {
        var status = this.getStatus( storeKey ),
            _skToData = this._skToData,
            _skToCommitted = this._skToCommitted,
            _skToChanged = this._skToChanged,
            current = _skToData[ storeKey ],
            changedKeys = [],
            seenChange = false,
            Type, key, value, oldValue, committed, changed;

        if ( !( status & READY ) ) {
            Type = this._skToType[ storeKey ];
            NS.RunLoop.didError({
                name: CANNOT_WRITE_TO_UNREADY_RECORD_ERROR,
                message:
                    '\nStatus: ' +
                        ( Object.keyOf( Status, status ) || status ) +
                    '\nData: ' + JSON.stringify( data )
            });
            return false;
        }

        // Copy-on-write for nested stores.
        if ( this.isNested && !_skToData.hasOwnProperty( storeKey ) ) {
            _skToData[ storeKey ] = current = NS.clone( current );
        }

        if ( changeIsDirty && status !== (READY|NEW) ) {
            committed = _skToCommitted[ storeKey ] ||
                ( _skToCommitted[ storeKey ] = NS.clone( current ) );
            changed = _skToChanged[ storeKey ] ||
                ( _skToChanged[ storeKey ] = {} );

            for ( key in data ) {
                value = data[ key ];
                oldValue = current[ key ];
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
                for ( key in changed ) {
                    if ( changed[ key ] ) {
                        seenChange = true;
                        break;
                    }
                }
            }
            // If there are still changes remaining, set the DIRTY flag and
            // commit. Otherwise, remove the DIRTY flag and reset state.
            if ( seenChange ) {
                this.setDirty( storeKey );
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
        } else {
            for ( key in data ) {
                value = data[ key ];
                oldValue = current[ key ];
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
    revertData: function ( storeKey ) {
        var committed = this._skToCommitted[ storeKey ];
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
    _notifyRecordOfChanges: function ( storeKey, changedKeys ) {
        var record = this._skToRecord[ storeKey ],
            l = changedKeys.length,
            attrs, attrKey, propKey, attribute, errorForAttribute;
        if ( record ) {
            attrs = NS.meta( record ).attrs;
            record.beginPropertyChanges();
            while ( l-- ) {
                attrKey = changedKeys[l];
                propKey = attrs[ attrKey ];
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
                attribute = record[ propKey ];
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
        Method: O.Store#sourceDidFetchAllRecords

        Callback made by the <O.Source> object associated with this store when
        it fetches all records of a particular type. Any records previously
        loaded but not in the new set will be presumed destroyed by the server.

        Parameters:
            Type    - {O.Class} The record type.
            records - {Object[]} Array of data objects.
            state   - {String} (optional) State of server for this type.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchAllRecords: function ( Type, records, state ) {
        var typeId = guid( Type );
        this.sourceDidFetchRecords( Type, records, true );
        if ( state ) {
            this._typeToClientState[ typeId ] = state;
        }
        this._typeToStatus[ typeId ] = READY;
        NS.RunLoop.queueFn( 'middle',
            this.liveQueriesAreReady.bind( this, Type ) );
        return this;
    },

    /**
        Method: O.Store#sourceDidFetchAllRecordUpdates

        Callback made by the <O.Source> object associated with this store when
        it fetches all changes that have been made to records of a particular
        type since the client last did a fetch.

        Parameters:
            Type     - {O.Class} The record type.
            added    - {Array} List of data objects for records added to the
                       source since oldState.
            changed  - {Object} A map of id to data object or partial data
                       object (with just the fields that have changed) for
                       records which have been modified in the source since
                       oldState.
            removed  - {Array} List of ids for records which have been destroyed
                       in the store since oldState.
            oldState - {String} The state these changes are from.
            newState - {String} The state these changes are to.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchAllRecordUpdates:
            function ( Type, added, changed, removed, oldState, newState ) {
        var typeId = guid( Type );
        this._typeToStatus[ typeId ] &= ~LOADING;
        if ( this._typeToClientState[ typeId ] === oldState ) {
            if ( added ) {
                this.sourceDidFetchRecords( Type, added );
            }
            if ( changed ) {
                this.sourceDidFetchUpdates( Type, changed );
            }
            if ( removed ) {
                this.sourceDidDestroyRecords( Type, removed );
            }
            this._typeToClientState[ typeId ] = newState;
            this._checkServerStatus( Type, newState );
        } else {
            this.sourceStateDidChange( Type, newState );
        }
        return this;
    },

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
    sourceCommitDidChangeState: function ( Type, oldState, newState ) {
        var typeId = guid( Type ),
            _typeToClientState = this._typeToClientState;

        this._typeToStatus[ typeId ] &= ~COMMITTING;

        if ( _typeToClientState[ typeId ] === oldState ) {
            _typeToClientState[ typeId ] = newState;
            this._checkServerStatus( Type, newState );
        } else {
            NS.RunLoop.didError({
                name: SOURCE_COMMIT_ON_UNKNOWN_STATE,
                message: 'Type: ' + typeId
            });
            _typeToClientState[ typeId ] = null;
            delete this._typeToServerState[ typeId ];
            this.fetchAll( Type );
        }

        return this;
    },

    // ---

    /**
        Method: O.Store#sourceDidFetchRecords

        Callback made by the <O.Source> object associated with this store when
        it fetches some records from the server.

        Parameters:
            Type    - {O.Class} The record type.
            records - {Object[]} Array of data objects.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidFetchRecords: function ( Type, records, _all ) {
        var l = records.length,
            idPropKey = Type.primaryKey || 'id',
            idAttrKey = Type.prototype[ idPropKey ].key || idPropKey,
            now = Date.now(),
            seen = {},
            updates = {},
            data, id, storeKey, status;

        while ( l-- ) {
            data = records[l];
            id = data[ idAttrKey ];
            seen[ id ] = true;
            storeKey = this.getStoreKey( Type, id );
            status = this.getStatus( storeKey );

            // If we already have the record loaded, process it as an update.
            if ( status & READY ) {
                updates[ id ] = data;
            }
            // Anything else is new.
            else {
                // Shouldn't have been able to fetch a destroyed or non-existent
                // record. Smells like an error: log it.
                if ( !( status & EMPTY ) ) {
                    NS.RunLoop.didError({
                        name: FETCHED_IS_DESTROYED_OR_NON_EXISTENT_ERROR,
                        message:
                            '\nStatus: ' +
                                ( Object.keyOf( Status, status ) || status ) +
                            '\nId: ' + id
                    });
                    // Set status back to empty so setData works.
                    this.setStatus( storeKey, EMPTY );
                }
                this.setData( storeKey, data );
                this.setStatus( storeKey, READY );
                this._skToLastAccess[ storeKey ] = now;
            }
        }

        if ( _all ) {
            var _idToSk = this._typeToIdToSk[ guid( Type ) ],
                destroyed = [];
            for ( id in _idToSk ) {
                if ( !seen[ id ] ) {
                    destroyed.push( id );
                }
            }
            if ( destroyed.length ) {
                this.sourceDidDestroyRecords( Type, destroyed );
            }
        }

        return this.sourceDidFetchUpdates( Type, updates );
    },

    /**
        Method: O.Store#sourceHasUpdatesForRecords

        Callback made by the <O.Source> object associated with this store when
        some records may be out of date.

        Parameters:
            Type   - {O.Class} The record type.
            idList - {String[]} Array of record ids for records of the
                     given type which have updates available on the server.

        Returns:
            {O.Store} Returns self.
    */
    sourceHasUpdatesForRecords: function ( Type, idList ) {
        var _skToStatus = this._skToStatus,
            _idToSk = this._typeToIdToSk[ guid( Type ) ] || {},
            l = idList.length,
            storeKey, status;

        while ( l-- ) {
            storeKey = _idToSk[ idList[l] ];
            status = _skToStatus[ storeKey ];
            if ( status & READY ) {
                this.setObsolete( storeKey );
            }
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidFetchUpdates

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
    sourceDidFetchUpdates: function ( Type, updates ) {
        var typeId = guid( Type ),
            _skToData = this._skToData,
            _skToStatus = this._skToStatus,
            _idToSk = this._typeToIdToSk[ typeId ] || {},
            _skToId = this._typeToSkToId[ typeId ] || {},
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            _skToRollback = this._skToRollback,
            idPropKey = Type.primaryKey || 'id',
            idAttrKey = Type.prototype[ idPropKey ].key || idPropKey,
            id, storeKey, status, update, newId;

        for ( id in updates ) {
            storeKey = _idToSk[ id ];
            status = _skToStatus[ storeKey ];
            update = updates[ id ];

            // Can't update an empty or destroyed record.
            if ( !( status & READY ) ) {
                continue;
            }

            // If committing, we don't know what the state will be (as the
            // commit is applied on top of the new state on the server;
            // result depends on whether the record is committed atomically
            // or just on the attribute level. So we'll apply the update on the
            // last known committed state (as this is what it's presumed to diff
            // from) and remove the committing flag. This will make the store
            // mark the record obsolete when the commit finishes. It will then
            // be rerequested from the server if required.
            if ( status & COMMITTING ) {
                update = NS.extend( _skToRollback[ storeKey ], update );
                delete _skToRollback[ storeKey ];
            }

            if ( status & DIRTY ) {
                // If we have a conflict we can either rebase on top, or discard
                // our local changes.
                update = NS.extend( _skToCommitted[ storeKey ], update );
                if ( this.rebaseConflicts ) {
                    var oldData = _skToData[ storeKey ],
                        oldChanged = _skToChanged[ storeKey ],
                        newData = {},
                        newChanged = {},
                        clean = true,
                        key;
                    // Every key in here must be reapplied on top, even if
                    // changed[key] === false, as this means it's been
                    // changed then changed back.
                    for ( key in oldData ) {
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

            newId = update[ idAttrKey ];
            if ( newId && newId !== id ) {
                _skToId[ storeKey ] = newId;
                delete _idToSk[ id ];
                _idToSk[ newId ] = storeKey;
            }

            this.updateData( storeKey, update, false );
            this.setStatus( storeKey, READY );
        }
        return this;
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
    sourceCouldNotFindRecords: function ( Type, idList ) {
        var l = idList.length,
            _skToCommitted = this._skToCommitted,
            _skToChanged = this._skToChanged,
            storeKey, status;

        while ( l-- ) {
            storeKey = this.getStoreKey( Type, idList[l] );
            status = this.getStatus( storeKey );
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
    sourceDidDestroyRecords: function ( Type, idList ) {
        var l = idList.length,
            _skToCommitted = this._skToCommitted,
            _skToChanged = this._skToChanged,
            storeKey, status;

        while ( l-- ) {
            storeKey = this.getStoreKey( Type, idList[l] );
            status = this.getStatus( storeKey );
            if ( status & DIRTY ) {
                this.setData( storeKey, _skToCommitted[ storeKey ] );
                delete _skToCommitted[ storeKey ];
                delete _skToChanged[ storeKey ];
            }
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
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
            skToId - {Object} A map of the store key to the record id for all
            newly created records.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidCommitCreate: function ( skToId ) {
        var storeKey, status;
        for ( storeKey in skToId ) {
            status = this.getStatus( storeKey );
            if ( status & NEW ) {
                this.setIdForStoreKey( storeKey, skToId[ storeKey ] );
                this.setStatus( storeKey, status & ~(NEW|COMMITTING) );
            } else {
                NS.RunLoop.didError({
                    name: SOURCE_COMMIT_CREATE_MISMATCH_ERROR
                });
            }
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidNotCreate

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the creation of some records as requested
        by a call to <O.Source#commitChanges> (usually due to a precondition
        fail, such as the server being in a different state to the client).

        This is presumed a temporary failure and the store will try again next
        time <O.Store#commitChanges> is called. If the failure is permanent, the
        storeKey should instead by included in a callback to
        <O.Store#sourceDidError> instead.

        Parameters:
            storeKeys - {String[]} The list of store keys of records for
                        which the create was not committed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotCreate: function ( storeKeys ) {
        var l = storeKeys.length,
            _skToCommitted = this._skToCommitted,
            _skToChanged = this._skToChanged,
            _created = this._created,
            storeKey, status;
        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            if ( status & DESTROYED ) {
                this.setStatus( storeKey, DESTROYED );
                this.unloadRecord( storeKey );
            }
            else {
                if ( status & DIRTY ) {
                    delete _skToCommitted[ storeKey ];
                    delete _skToChanged[ storeKey ];
                }
                this.setStatus( storeKey, (READY|NEW) );
                _created[ storeKey ] = 1;
            }
        }
        return this;
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
    sourceDidCommitUpdate: function ( storeKeys ) {
        var l = storeKeys.length,
            _skToRollback = this._skToRollback,
            storeKey, status;

        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            delete _skToRollback[ storeKey ];
            // We don't care about updates to records not in memory.
            if ( !( status & READY ) ) {
                continue;
            }
            if ( !( status & COMMITTING ) ) {
                this.setObsolete( storeKey );
            } else {
                this.setStatus( storeKey, status & ~COMMITTING );
            }
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidNotUpdate

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the updates to some records as requested
        by a call to <O.Source#commitChanges> (usually due to a precondition
        fail, such as the server being in a different state to the client).

        This is presumed a temporary failure and the store will try again next
        time <O.Store#commitChanges> is called. If the failure is permanent, the
        storeKey should instead by included in a callback to
        <O.Store#sourceDidError> instead.

        Parameters:
            storeKeys - {String[]} The list of store keys of records for
                        which the update was not committed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotUpdate: function ( storeKeys ) {
        var l = storeKeys.length,
            _skToData = this._skToData,
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            _skToRollback = this._skToRollback,
            storeKey, status, committed, current, key, changed;

        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            // We don't care about updates to records not in memory.
            if ( !( status & READY ) ) {
                continue;
            }
            committed = _skToCommitted[ storeKey ] = _skToRollback[ storeKey ];
            delete _skToRollback[ storeKey ];
            if ( status & DIRTY ) {
                changed = {};
                current = _skToData[ storeKey ];
                delete _skToChanged[ storeKey ];
                for ( key in current ) {
                    if ( !isEqual( current[ key ], committed[ key ] ) ) {
                        changed[ key ] = true;
                        _skToChanged[ storeKey ] = changed;
                    }
                }
            }
            if ( !( status & COMMITTING ) ) {
                this.setObsolete( storeKey );
            } else {
                this.setStatus( storeKey, ( status & ~COMMITTING )|DIRTY );
            }
        }
        return this;
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
    sourceDidCommitDestroy: function ( storeKeys ) {
        var l = storeKeys.length,
            storeKey, status;
        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            if ( !( status & DESTROYED ) ) {
                NS.RunLoop.didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR
                });
            }
            this.setStatus( storeKey, DESTROYED );
            this.unloadRecord( storeKey );
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidNotDestroy

        Callback made by the <O.Source> object associated with this store when
        the source does not commit the destruction of some records as requested
        by a call to <O.Source#commitChanges> (usually due to a precondition
        fail, such as the server being in a different state to the client).

        This is presumed a temporary failure and the store will try again next
        time <O.Store#commitChanges> is called. If the failure is permanent, the
        storeKey should instead by included in a callback to
        <O.Store#sourceDidError> instead.

        Parameters:
            storeKeys - {String[]} The list of store keys of records for
                        which the destruction was not committed.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidNotDestroy: function ( storeKeys ) {
        var l = storeKeys.length,
            _destroyed = this._destroyed,
            storeKey, status;
        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            if ( !( status & DESTROYED ) ) {
                NS.RunLoop.didError({
                    name: SOURCE_COMMIT_DESTROY_MISMATCH_ERROR
                });
            }
            this.setStatus( storeKey, (DESTROYED|DIRTY) );
            _destroyed[ storeKey ] = 1;
        }
        return this;
    },

    /**
        Method: O.Store#sourceDidError

        Callback made by the <O.Source> object associated with this store when
        the attempt to commit a creation/update/deletion for a particular record
        fails permanently (perhaps because the data being committed was invalid,
        for example). The store will rollback the state of the record to the
        last known committed state.

        Parameters:
            storeKeys - {String[]} The list of store keys of records for
                        which the commit failed permanently.

        Returns:
            {O.Store} Returns self.
    */
    sourceDidError: function ( storeKeys ) {
        var l = storeKeys.length,
            _skToChanged = this._skToChanged,
            _skToCommitted = this._skToCommitted,
            _skToRollback = this._skToRollback,
            storeKey, status;
        while ( l-- ) {
            storeKey = storeKeys[l];
            status = this.getStatus( storeKey );
            // Newly created -> destroy
            if ( status & NEW ) {
                this.setStatus( storeKey, DESTROYED );
                this.unloadRecord( storeKey );
            // Newly destroyed or updated -> revert to ready + obsolete
            } else {
                if ( _skToRollback[ storeKey ] ) {
                    this.setData( storeKey, _skToRollback[ storeKey ] );
                }
                delete _skToChanged[ storeKey ];
                delete _skToCommitted[ storeKey ];
                delete _skToRollback[ storeKey ];
                this.setStatus( storeKey, (READY|OBSOLETE) );
            }
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
    findAll: function ( Type, accept, compare ) {
        var _skToId = this._typeToSkToId[ guid( Type ) ] || {},
            _skToStatus = this._skToStatus,
            results = [],
            storeKey, filterFn, sortFn;

        for ( storeKey in _skToId ) {
            if ( _skToStatus[ storeKey ] & READY ) {
                results.push( storeKey );
            }
        }

        if ( accept ) {
            filterFn = filter.bind( this, accept );
            results = results.filter( filterFn );
            results.filterFn = filterFn;
        }

        if ( compare ) {
            sortFn = sort.bind( this, compare );
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
    findOne: function ( Type, accept ) {
        var _skToId = this._typeToSkToId[ guid( Type ) ] || {},
            _skToStatus = this._skToStatus,
            filterFn = accept && filter.bind( this, accept ),
            storeKey;

        for ( storeKey in _skToId ) {
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
    addQuery: function ( query ) {
        var source = this.source;
        this._idToQuery[ query.get( 'id' ) ] = query;
        if ( query instanceof NS.LiveQuery ) {
            var Type = query.get( 'Type' ),
                typeId = guid( Type );
            this.fetchAll( Type );
            ( this._liveQueries[ typeId ] ||
                ( this._liveQueries[ typeId ] = [] ) ).push( query );
        } else if ( query instanceof NS.RemoteQuery ) {
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
    removeQuery: function ( query ) {
        delete this._idToQuery[ query.get( 'id' ) ];
        if ( query instanceof NS.LiveQuery ) {
            var _liveQueries = this._liveQueries,
                typeId = guid( query.get( 'Type' ) ),
                typeQueries = _liveQueries[ typeId ];
            if ( typeQueries.length > 1 ) {
                typeQueries.erase( query );
            } else {
                delete _liveQueries[ typeId ];
            }
        } else if ( query instanceof NS.RemoteQuery ) {
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
    getQuery: function ( id, QueryClass, mixin ) {
        var query = ( id && this._idToQuery[ id ] ) || null;
        if ( !query && QueryClass ) {
            query = new QueryClass( NS.extend( mixin || {}, {
                id: id,
                store: this,
                source: this.source
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
    getAllRemoteQueries: function () {
        return this._remoteQueries;
    },

    /**
        Method (protected): O.Store#_recordDidChange

        Registers a record has changed in a way that might affect any live
        queries on that type.

        Parameters:
            storeKey - {String} The store key of the record.
    */
    _recordDidChange: function ( storeKey ) {
        var typeId = guid( this._skToType[ storeKey ] ),
            _typeToChangedSks = this._typeToChangedSks,
            changedSks = _typeToChangedSks[ typeId ] ||
                ( _typeToChangedSks[ typeId ] = {} );
        changedSks[ storeKey ] = true;
        NS.RunLoop.queueFn( 'middle', this.refreshLiveQueries, this );
    },

    /**
        Method: O.Store#refreshLiveQueries

        Refreshes the contents of all registered instances of <O.LiveQuery>
        which may have changes. This is automatically called when necessary by
        the store; you should rarely need to call this manually.

        Returns:
            {O.Store} Returns self.
    */
    refreshLiveQueries: function () {
        var _typeToChangedSks = this._typeToChangedSks,
            _liveQueries = this._liveQueries,
            typeId, typeChanges, typeQueries,
            l;

        this._typeToChangedSks = {};

        for ( typeId in _typeToChangedSks ) {
            typeChanges = Object.keys( _typeToChangedSks[ typeId ] );
            typeQueries = _liveQueries[ typeId ];
            l = typeQueries ? typeQueries.length : 0;

            while ( l-- ) {
                typeQueries[l].storeDidChangeRecords( typeChanges );
            }
            this.fire( typeId, {
                storeKeys: typeChanges
            });
        }

        return this;
    },

    liveQueriesAreReady: function ( Type ) {
        var _liveQueries = this._liveQueries[ guid( Type ) ],
            l = _liveQueries ? _liveQueries.length : 0;
        while ( l-- ) {
            _liveQueries[l].set( 'status', READY );
        }
    }
});

[ 'on', 'once', 'off' ].forEach( function ( property ) {
    Store.prototype[ property ] = function ( type, obj, method ) {
        if ( typeof type !== 'string' ) {
            type = guid( type );
        }
        return NS.EventTarget[ property ].call( this, type, obj, method );
    };
});

NS.Store = Store;

}( O ) );
