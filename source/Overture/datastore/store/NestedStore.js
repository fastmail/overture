import { Class, isEqual, clone } from '../../core/Core.js';
import RunLoop from '../../foundation/RunLoop.js';

import {
    // Core states:
    EMPTY,
    READY,
    DESTROYED,
    // Properties
    LOADING,     // Request made to source to fetch record or updates.
    COMMITTING,  // Request been made to source to commit record.
    NEW,         // Record has not been committed to source.
    DIRTY,       // Record has local changes not commited to source
    OBSOLETE,    // Source may have changes not yet loaded.
} from '../record/Status.js';

import Store from './Store.js';

/**
    Class: O.NestedStore

    A Nested Store may be used to buffer changes before committing them to the
    parent store. The changes may be discarded instead of committing without
    ever affecting the parent store.
*/
const NestedStore = Class({

    Extends: Store,

    autoCommit: false,
    isNested: true,

    /**
        Constructor: O.NestedStore

        Parameters:
            store - {O.Store} The parent store (this may be another nested
                    store).
    */
    init( store ) {
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
        // Not used, but needs to be present to stop error on unload
        this._skToRollback = {};

        // Share last access timestamp for
        this._skToLastAccess = store._skToLastAccess;

        this._created = {};
        this._destroyed = {};
        this.hasChanges = false;

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

        // Type -> [ store key ] of changed records.
        this._typeToChangedSks = {};

        this._typeToStatus = store._typeToStatus;

        store.addNested( this );

        this._source = store._source;
        this._parentStore = store;
    },

    /**
        Method: O.NestedStore#destroy

        Removes the connection to the parent store so this store may be garbage
        collected.
    */
    destroy() {
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
    commitChanges() {
        this.fire( 'willCommit' );
        const _created = this._created;
        const _destroyed = this._destroyed;
        const _skToData = this._skToData;
        const _skToChanged = this._skToChanged;
        const parent = this._parentStore;

        for ( const storeKey in _created ) {
            const status = parent.getStatus( storeKey );
            const data = _skToData[ storeKey ];
            if ( status === EMPTY || status === DESTROYED ) {
                parent.createRecord( storeKey, data );
            } else if ( ( status & ~(OBSOLETE|LOADING) ) ===
                    (DESTROYED|COMMITTING) ) {
                parent._skToData[ storeKey ] = data;
                parent.setStatus( storeKey, READY|NEW|COMMITTING );
            } else if ( status & DESTROYED ) {
                delete parent._destroyed[ storeKey ];
                parent._skToData[ storeKey ] = data;
                parent.setStatus( storeKey,
                    ( status & ~(DESTROYED|DIRTY) ) | READY );
            }
        }
        for ( const storeKey in _skToChanged ) {
            parent.updateData( storeKey, Object.filter(
                _skToData[ storeKey ], _skToChanged[ storeKey ] ), true );
        }
        for ( const storeKey in _destroyed ) {
            parent.destroyRecord( storeKey );
        }

        this._skToData = Object.create( parent._skToData );
        this._skToStatus = Object.create( parent._skToStatus );
        this._skToChanged = {};
        this._skToCommitted = {};
        this._created = {};
        this._destroyed = {};

        return this.set( 'hasChanges', false ).fire( 'didCommit' );
    },

    /**
        Method: O.Store#discardChanges

        Discards any outstanding changes (created/updated/deleted records),
        reverting the store to the same state as its parent.

        Returns:
            {O.NestedStore} Returns self.
    */
    discardChanges() {
        NestedStore.parent.discardChanges.call( this );

        const parent = this._parentStore;

        this._skToData = Object.create( parent._skToData );
        this._skToStatus = Object.create( parent._skToStatus );

        return this;
    },

    // === Low level (primarily internal) API: uses storeKey ===================

    getStatus( storeKey ) {
        const status = this._skToStatus[ storeKey ] || EMPTY;
        return this._skToData.hasOwnProperty( storeKey ) ?
            status : status & ~(NEW|COMMITTING|DIRTY);
    },

    fetchAll( storeKey ) {
        this._parentStore.fetchAll( storeKey );
        return this;
    },

    fetchData( storeKey ) {
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
    parentDidChangeStatus( storeKey, previous, status ) {
        const _skToStatus = this._skToStatus;

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
            const record = this._skToRecord[ storeKey ];
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
    parentDidSetData( storeKey, changedKeys ) {
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
    parentDidUpdateData( storeKey, changedKeys ) {
        if ( this._skToData.hasOwnProperty( storeKey ) ) {
            const _skToData = this._skToData;
            const _skToChanged = this._skToChanged;
            const _skToCommitted = this._skToCommitted;
            const parent = this._parentStore;
            const rebase = this.rebaseConflicts;
            const newBase = parent.getData( storeKey );
            const oldData = _skToData[ storeKey ];
            const oldChanged = _skToChanged[ storeKey ];
            const newData = {};
            const newChanged = {};
            let clean = true;
            let isChanged, key;

            changedKeys = [];

            for ( key in oldData ) {
                isChanged = !isEqual( oldData[ key ], newBase[ key ] );
                if ( rebase && ( key in oldChanged ) ) {
                    if ( isChanged ) {
                        newChanged[ key ] = true;
                        clean = false;
                    }
                    newData[ key ] = oldData[ key ];
                } else {
                    if ( isChanged ) {
                        changedKeys.push( key );
                    }
                    newData[ key ] = newBase[ key ];
                }
            }
            if ( !clean ) {
                _skToChanged[ storeKey ] = newChanged;
                _skToCommitted[ storeKey ] = clone( newBase );
                this.setData( storeKey, newData );
                return;
            }
            this.setStatus( storeKey,
                parent.getStatus( storeKey ) & ~(NEW|COMMITTING|DIRTY) );
            delete _skToData[ storeKey ];
            delete _skToChanged[ storeKey ];
            delete _skToCommitted[ storeKey ];
            delete this._skToStatus[ storeKey ];
        }
        this._notifyRecordOfChanges( storeKey, changedKeys );
        this._nestedStores.forEach( function ( store ) {
            store.parentDidUpdateData( storeKey, changedKeys );
        });
        this._recordDidChange( storeKey );
        RunLoop.queueFn( 'before', this.checkForChanges, this );
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

export default NestedStore;
