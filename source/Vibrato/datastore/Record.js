// -------------------------------------------------------------------------- \\
// File: Record.js                                                            \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */
 
"use strict";

( function ( NS ) {

/**
    Class: O.Record-AttributeErrors
    
    Extends: O.Object
    
    Maintains the state of the validity of each attribute on a record.
*/
var AttributeErrors = NS.Class({

    Extends: NS.Object,
    
    _numErrors: 0,
    
    /**
        Constructor: O.Record-AttributeErrors
        
        Parameters:
            record - {O.Record} The record to manage attribute errors for.
    */
    init: function ( record ) {
        AttributeErrors.parent.init.call( this );
        this._record = record;

        var attrs = NS.meta( record ).attrs,
            metadata = NS.meta( this ),
            dependents = metadata.dependents = NS.clone( metadata.dependents );
        
        this.beginPropertyChanges();
        attrs.forEach( function ( attr ) {
            var attribute = record[ attr ],
                error = attribute.validate ?
                    attribute.validate( record.get( attr ), attr, record ) :
                    '',
                dependencies = attribute.validityDependencies,
                l, key;
            this.set( attr, error );
            if ( dependencies ) {
                l = dependencies.length;
                while ( l-- ) {
                    key = dependencies[l];
                    if ( !dependents[ key ] ) {
                        dependents[ key ] = [];
                        record.addObserverForKey( key, this, 'attrDidChange' );
                    }
                    dependents[ key ].push( attr );
                }
            }
        }, this );
        this.endPropertyChanges();
    },

    /**
        Method: O.Record-AttributeErrors#attrDidChange
        
        Called when an attribute changes on the record for which another
        attribute has a validity dependency.
        
        Parameters:
            _    - {*} Unused.
            attr - {String} The name of the attribute which has changed.
    */
    attrDidChange: function ( _, attr ) {
        var metadata = NS.meta( this ),
            changed = metadata.changed = {},
            dependents = metadata.dependents[ attr ],
            l = dependents.length,
            record = this._record,
            key, attribute;

        this.beginPropertyChanges();
        while ( l-- ) {
            key = dependents[l];
            attribute = record[ key ];
            changed[ key ] = {
                oldValue: this[ key ],
                newValue: this[ key ] = ( attribute.validate ?
                    attribute.validate( record.get( key ), key, record ) : '' )
            };
        }
        this.endPropertyChanges();
    },

    /**
        Method: O.Record-AttributeErrors#setRecordValidity
        
        Updates the internal count of how many attributes are invalid and sets
        the <O.Record#isValid> property. Called automatically whenever a
        validity error string changes.
        
        Parameters:
            _       - {*} Unused.
            changed - {Object} A map of validity string changes.
    */
    setRecordValidity: function ( _, changed ) {
        var numErrors = this._numErrors,
            key, vals, wasValid, isValid;
        for ( key in changed ) {
            vals = changed[ key ];
            wasValid = !vals.oldValue;
            isValid = !vals.newValue;
            if ( wasValid && !isValid ) {
                numErrors += 1;
            }
            else if ( isValid && !wasValid ) {
                numErrors -= 1;
            }
        }
        this._numErrors = numErrors;
        this._record.set( 'isValid', !numErrors );
    }.observes( '*' )
});

/**
    Class: O.Record
    
    Extends: O.Object
    
    All data object classes managed by the store must inherit from Record. This
    provides the basic status management for the attributes.
*/
var Record = NS.Class({
    
    Extends: NS.Object,
    
    /**
        Constructor: O.Record
        
        Parameters:
            store    - {Store} The store to link to this record.
            storeKey - {String} The unique id for this record in the store.
    */
    init: function ( store, storeKey ) {
        this.store = store;
        this.storeKey = storeKey;
        Record.parent.init.call( this );
    },
    
    /**
        Property: O.Record#store
        Type: (O.Store|undefined)
        
        The store this record is associated with.
    */
    
    /**
        Property: O.Record#storeKey
        Type: (String|undefined)
        
        The record store key; will be unique amonsgst all loaded records, even
        across those of different types.
    */
    
    /**
        Property: O.Record#status
        Type: O.Status
    
        The status of this Record. A Record goes through three primary phases:
        EMPTY -> READY -> DESTROYED. Alternatively it may go EMPTY ->
        NON_EXISTENT. Whilst in these phases it may acquire other properties:
        LOADING, NEW, DIRTY, OBSOLETE. Each of the primary phases as well as the
        secondary properties are different bits in the status bitarray. You
        should check the condition by using bitwise operators with the constants
        defined in <O.Status>.
    */
    status: function () {
        var store = this.get( 'store' );
        return store ?
            store.getStatus( this.get( 'storeKey' ) ) : NS.Status.READY;
    }.property().nocache(),
    
    /**
        Method: O.Record#is
        
        Checks whether record has a particular status. You can also supply a
        union of statuses (e.g. `record.is(O.Status.OBSOLETE|O.Status.DIRTY)`),
        in which case it will return true if the record has *any* of these
        status bits set.
        
        Parameters:
            state - {O.Status} A bit array corresponding
        
        Returns:
            {Boolean} True if the record has the queried status.
    */
    is: function ( state ) {
        return !!( this.get( 'status' ) & state );
    },
    
    /**
        Method: O.Record#setObsolete
        
        Adds <O.Status.OBSOLETE> to the current status value.
        
        Returns:
            {O.Record} Returns self.
    */
    setObsolete: function () {
        var store = this.get( 'store' );
        if ( store ) { store.setObsolete( this.get( 'storeKey' ) ); }
        return this;
    },
    
    /**
        Method: O.Record#setLoading
        
        Adds <O.Status.LOADING> to the current status value.
        
        Returns:
            {O.Record} Returns self.
    */
    setLoading: function () {
        var store = this.get( 'store' );
        if ( store ) { store.setLoading( this.get( 'storeKey' ) ); }
        return this;
    },
    
    /**
        Property: O.Record#id
        Type: String
        
        The record id.
    */
    id: function () {
        var store = this.get( 'store' );
        return store ?
            store.getIdFromStoreKey( this.get( 'storeKey' ) ) :
            this.get( this.constructor.primaryKey );
    }.property().nocache(),
    
    /**
        Method: O.Record#saveToStore
        
        Adds the record to the given store. Will then be committed back by the
        store according to the store's policy. Note, only a record not currently
        attached to a store can do this; an error will be thrown if this method
        is called for a record already in a store.
        
        Parameters:
            store - {O.Store} The store to put the record in.
        
        Returns:
            {O.Record} Returns self.
    */
    saveToStore: function ( store ) {
        if ( this.get( 'store' ) ) {
            throw "Record already belongs to a store.";
        }
        return store.newRecord( this.constructor, this );
    },
    
    /**
        Method: O.Record#discardChanges
        
        Reverts the attributes in the record to the last committed state. If
        the record has never been committed, this will destroy the record.
        
        Returns:
            {O.Record} Returns self.
    */
    discardChanges: function () {
        if ( this.get( 'status' ) === (O.Status.READY|O.Status.NEW) ) {
            this.destroy();
        } else {
            var store = this.get( 'store' );
            if ( store ) {
                store.revertHash( this.get( 'storeKey' ) );
            }
        }
        return this;
    },

    /**
        Method: O.Record#refresh
        
        Fetch/refetch the data from the source. Will have no effect if the
        record is new or already loading.
        
        Returns:
            {O.Record} Returns self.
    */
    refresh: function () {
        var store = this.get( 'store' );
        if ( store ) { store.fetchHash( this.get( 'storeKey' ) ); }
        return this;
    },
    
    /**
        Method: O.Record#destroy
        
        Destroy the record. This will inform the store, which will commit it to
        the source.
    */
    destroy: function () {
        var store = this.get( 'store' );
        if ( store ) { store.destroyRecord( this.get( 'storeKey' ) ); }
    },
    
    /**
        Method: O.Record#storeWillUnload
        
        This should only be called by the store, when it unloads the record's
        data to free up memory.
    */
    storeWillUnload: function () {
        Record.parent.destroy.call( this );
    },
    
    /**
        Property (private): O.Record#_noSync
        Type: Boolean
        
        If true, any changes to the record will not be committed to the source.
    */
    _noSync: false,
    
    /**
        Method: O.Record#stopSync
        
        Any changes after this has been invoked will not by synced to the
        source.
        
        Returns:
            {O.Record} Returns self.
    */
    stopSync: function () {
        this._noSync = true;
        return this;
    },
    
    /**
        Method: O.Record#startSync
        
        If syncing has been stopped by a call to <O.Record#stopSync>, this
        will then enable it again for any *future* changes.
        
        Returns:
            {O.Record} Returns self.
    */
    startSync: function () {
        this._noSync = false;
        return this;
    },
    
    /**
        Property: O.Record#isValid
        Type: Boolean
        
        Are all the attributes are in a valid state?
    */
    isValid: function ( value ) {
        if ( value !== undefined ) {
            return value;
        }
        return !this.get( 'errorForAttribute' )._numErrors;
    }.property(),
    
    /**
        Method: O.Record#errorToSet
        
        Checks whether it will be an error to set the attribute with the given
        key to the given value. If it will be an error, the string describing
        the error is returned, otherwise an empty string is returned.
        
        Parameters:
            key   - {String} The name of the attribute.
            value - {*} The proposed value to set it to.
        
        Returns:
            {String} The error message, or an empty string if the assignment
            would be valid.
    */
    errorToSet: function ( key, value ) {
        var attr = this[ key ];
        return attr.validate ? attr.validate( value, key, this ) : '';
    },
    
    /**
        Property: O.Record#errorForAttribute
        Type: O.Object
        
        Calling get() with the key for an attribute on this record will return
        an error string if the currently set value is invalid, or an empty
        string if the attribute is currently valid. You can bind to the
        properties on this object.
    */
    errorForAttribute: function () {
        return new AttributeErrors( this );
    }.property()
});

/**
    Property: O.Record.className
    Type: String
    
    Any Record subclass MUST define this property with the name of the class to
    allow for introspection and so the source knows what record type to fetch.
*/
/**
    Property: O.Record.primaryKey
    Type: String
    
    Any Record subclass MUST define this property to be the name of the
    instance property which is the primary key for the record.
*/

NS.Record = Record;

}( O ) );