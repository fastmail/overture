// -------------------------------------------------------------------------- \\
// File: NestedStore.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Store.js                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

// Same as O.Status, inlined here for efficiency:
// Core states:
var EMPTY      =   1;
var READY      =   2;
var DESTROYED  =   4;
// Properties
var LOADING    =  16; // Request made to source to fetch record or updates.
var COMMITTING =  32; // Request been made to source to commit record.
var NEW        =  64; // Record has not been committed to source.
var DIRTY      = 128; // Record has local changes not commited to source
var OBSOLETE   = 256; // Source may have changes not yet loaded.

/**
    Class: O.NestedStore
    
    A Nested Store may be used to buffer changes before committing them to the
    parent store. The changes may be discarded instead of committing without
    ever affecting the parent store.
*/
var NestedStore = NS.Class({
    
    Extends: NS.Store,
    
    autoCommit: false,
    isNested: true,
    
    /**
        Constructor: O.NestedStore
        
        Parameters:
            store - {O.Store} The parent store (this may be another nested
                    store).
    */
    init: function ( store ) {
        // Own record store
        this._skToRecord = {};
        // Copy on write, shared data object store
        this._skToData = Object.create( store._skToData );
        // Copy on write, shared status store.
        this._skToStatus = Object.create( store._skToStatus );
        
        // Share store key -> Type
        this._skToType = store._skToType;
        // Share Type -> store key -> id
        this._typeToSkToId = store._typeToSkToId;
        // Share Type -> id -> store key
        this._typeToIdToSk = store._typeToIdToSk;
        
        // Own changed map
        this._skToChanged = {};
        // Own previous attributes.
        this._skToCommitted = {};
        
        // Share last access timestamp for
        this._skToLastAccess = store._skToLastAccess;
        
        this._created = {};
        this._destroyed = {};
        
        // Own queries
        // Map id -> query
        this._idToQuery = {};
        // Map Type -> list of local queries
        this._liveQueries = {};
        // Set of remove queries.
        this._remoteQueries = [];
        // List of types needing a refresh.
        this._queryTypesNeedRefresh = [];
        
        // List of nested stores
        this._nestedStores = [];
        
        // Waiting for an id
        this._awaitingId = {};
        
        // Type -> [ store key ] of changed records.
        this._typeToChangedSks = {};
        
        store.addNested( this );
        
        this._source = store._source;
        this._parentStore = store;
    },
    
    /**
        Method: O.NestedStore#destroy
        
        Removes the connection to the parent store so this store may be garbage
        collected.
    */
    destroy: function () {
        this._parentStore.removeNested( this );
    },
    
    // === Client API ==========================================================
    
    /**
        Method: O.Store#commitChanges
        
        Commits any outstanding changes (created/updated/deleted records) to the
        parent store.
        
        Returns:
            {O.NestedStore} Returns self.
    */
    commitChanges: function () {
        var _created = this._created,
            _destroyed = this._destroyed,
            _skToData = this._skToData,
            _skToChanged = this._skToChanged,
            parent = this._parentStore,
            storeKey;
        
        for ( storeKey in _created ) {
            parent.createRecord( storeKey, _skToData[ storeKey ] );
        }
        for ( storeKey in _skToChanged ) {
            parent.updateData( storeKey, Object.filter(
                _skToData[ storeKey ], _skToChanged[ storeKey ] ), true );
        }
        for ( storeKey in _destroyed ) {
            parent.destroyRecord( storeKey );
        }
        
        this._skToData = Object.create( parent._skToData );
        this._skToStatus = Object.create( parent._skToStatus );
        this._skToChanged = {};
        this._skToCommitted = {};
        this._created = {};
        this._destroyed = {};

        return this;
    },
    
    /**
        Method: O.Store#discardChanges
        
        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the same state as its parent.
        
        Returns:
            {O.NestedStore} Returns self.
    */
    discardChanges: function () {
        NestedStore.parent.discardChanges.call( this );
        
        var parent = this._parentStore;
        
        this._skToData = Object.create( parent._skToData );
        this._skToStatus = Object.create( parent._skToStatus );

        return this;
    },
     
    // === Low level (primarily internal) API: uses storeKey ===================
    
    getStatus: function ( storeKey ) {
        var status = this._skToStatus[ storeKey ] || EMPTY;
        return this._skToData.hasOwnProperty( storeKey ) ?
            status : status & ~(NEW|COMMITTING|DIRTY);
    },
    
    setObsolete: function ( storeKey ) {
        this._parentStore.setObsolete( storeKey );
    },
    setLoading: function ( storeKey ) {
        this._parentStore.setLoading( storeKey );
    },
    
    fetchAll: function ( storeKey ) {
        this._parentStore.fetchAll( storeKey );
        return this;
    },
    
    fetchData: function ( storeKey ) {
        this._parentStore.fetchData( storeKey );
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
            storeKey - {String} The store key for the record.
            previous - {O.Status} The previous status value.
            status   - {O.Status} The new status value.
    */
    parentDidChangeStatus: function ( storeKey, previous, status ) {
        var _skToStatus = this._skToStatus;
        
        previous = previous & ~(NEW|COMMITTING|DIRTY);
        status = status & ~(NEW|COMMITTING|DIRTY);
        
        if ( _skToStatus.hasOwnProperty( storeKey ) ) {
            previous = _skToStatus[ storeKey ];
            if ( status & DESTROYED ) {
                if ( !( previous & DESTROYED ) ) {
                    // Ready dirty -> ready clean.
                    this.setData( storeKey, this._skToCommitted[ storeKey ] );
                    delete this._skToCommitted[ storeKey ];
                    delete this._skToChanged[ storeKey ];
                }
                // Ready clean/Destroyed dirty -> destroyed clean.
                delete this._skToData[ storeKey ];
                delete _skToStatus[ storeKey ];
            } else {
                _skToStatus[ storeKey ] = status =
                    previous|( status & (OBSOLETE|LOADING) );
            }
        }
        
        if ( previous !== status ) {
            // wasReady !== isReady
            if ( ( previous ^ status ) & READY ) {
                this._recordDidChange( storeKey );
            }
            var record = this._skToRecord[ storeKey ];
            if ( record ) {
                record.propertyDidChange( 'status', previous, status );
            }
            this._nestedStores.forEach( function ( store ) {
                store.parentDidChangeStatus( storeKey, previous, status );
            });
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
    parentDidSetData: function ( storeKey, changedKeys ) {
        this._notifyRecordOfChanges( storeKey, changedKeys );
        this._nestedStores.forEach( function ( store ) {
            store.parentDidSetData( storeKey, changedKeys );
        });
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
    parentDidUpdateData: function ( storeKey, changedKeys ) {
        if ( this._skToData.hasOwnProperty( storeKey ) ) {
            var _skToData = this._skToData,
                _skToChanged = this._skToChanged,
                _skToCommitted = this._skToCommitted,
                parent = this._parentStore,
                rebase = this.rebaseConflicts,
                newBase = parent.getData( storeKey ),
                oldData = _skToData[ storeKey ],
                oldChanged = _skToChanged[ storeKey ],
                newData = {},
                newChanged = {},
                clean = true,
                key;

            changedKeys = [];

            for ( key in oldData ) {
                if ( rebase && ( key in oldChanged ) ) {
                    if ( oldData[ key ] !== newBase[ key ] ) {
                        newChanged[ key ] = true;
                        clean = false;
                    }
                    newData[ key ] = oldData[ key ];
                } else {
                    if ( oldData[ key ] !== newBase[ key ] ) {
                        changedKeys.push( key );
                    }
                    newData[ key ] = newBase[ key ];
                }
            }
            if ( !clean ) {
                _skToChanged[ storeKey ] = newChanged;
                _skToCommitted[ storeKey ] = NS.clone( newBase );
                this.setData( storeKey, newData );
                return;
            }
            delete _skToData[ storeKey ];
            delete _skToChanged[ storeKey ];
            delete _skToCommitted[ storeKey ];
            this.setStatus( storeKey,
                parent.getStatus( storeKey ) & ~(NEW|COMMITTING|DIRTY) );
            delete this._skToStatus[ storeKey ];
        }
        this._notifyRecordOfChanges( storeKey, changedKeys );
        this._nestedStores.forEach( function ( store ) {
            store.parentDidUpdateData( storeKey, changedKeys );
        });
        this._recordDidChange( storeKey );
    },
    
    // === A nested store is not directly connected to a source ================
    
    sourceDidFetchAllRecords: null,
    sourceDidFetchRecords: null,
    sourceHasUpdatesForRecords: null,
    sourceDidFetchUpdates: null,
    sourceCouldNotFindRecords: null,
    sourceDidDestroyRecords: null,
    sourceDidCommitCreate: null,
    sourceDidNotCreate: null,
    sourceDidCommitUpdate: null,
    sourceDidNotUpdate: null,
    sourceDidCommitDestroy: null,
    sourceDidNotDestroy: null
});

NS.NestedStore = NestedStore;

}( O ) );
