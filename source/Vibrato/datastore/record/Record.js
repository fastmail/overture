// -------------------------------------------------------------------------- \\
// File: Record.js                                                            \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
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

    /**
        Property: O.Record-AttributeErrors#errorCount
        Type: Number

        The number of attributes on the record in an error state.
    */
    errorCount: 0,

    /**
        Constructor: O.Record-AttributeErrors

        Parameters:
            record - {O.Record} The record to manage attribute errors for.
    */
    init: function ( record ) {
        AttributeErrors.parent.init.call( this );

        var attrs = NS.meta( record, true ).attrs,
            metadata = NS.meta( this, false ),
            dependents = metadata.dependents = NS.clone( metadata.dependents ),
            errorCount = 0,
            attrKey, propKey, attribute, error, dependencies, l, key;

        for ( attrKey in attrs ) {
            // Check if attribute has been removed (e.g. in a subclass).
            if ( propKey = attrs[ attrKey ] ) {
                // Validate current value and set error on this object.
                attribute = record[ propKey ];
                error = this[ propKey ] = attribute.validate ?
                  attribute.validate( record.get( propKey ), propKey, record ) :
                  '';

                // Keep an error count
                if ( error ) { errorCount += 1; }

                // Add observers for validity dependencies.
                dependencies = attribute.validityDependencies;
                if ( dependencies ) {
                    l = dependencies.length;
                    while ( l-- ) {
                        key = dependencies[l];
                        if ( !dependents[ key ] ) {
                            dependents[ key ] = [];
                            record.addObserverForKey(
                                key, this, 'attrDidChange' );
                        }
                        dependents[ key ].push( propKey );
                    }
                }
            }
        }

        this.errorCount = errorCount;
        this._record = record;
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
        var metadata = NS.meta( this, false ),
            changed = metadata.changed = {},
            dependents = metadata.dependents[ attr ],
            l = dependents.length,
            record = this._record,
            propKey, attribute;

        this.beginPropertyChanges();
        while ( l-- ) {
            propKey = dependents[l];
            attribute = record[ propKey ];
            changed[ propKey ] = {
                oldValue: this[ propKey ],
                newValue: this[ propKey ] = ( attribute.validate ?
                  attribute.validate( record.get( propKey ), propKey, record ) :
                  '' )
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
        var errorCount = this.get( 'errorCount' ),
            key, vals, wasValid, isValid;
        for ( key in changed ) {
            if ( key !== 'errorCount' ) {
                vals = changed[ key ];
                wasValid = !vals.oldValue;
                isValid = !vals.newValue;
                if ( wasValid && !isValid ) {
                    errorCount += 1;
                }
                else if ( isValid && !wasValid ) {
                    errorCount -= 1;
                }
            }
        }
        this.set( 'errorCount', errorCount )
            ._record.set( 'isValid', !errorCount );
    }.observes( '*' )
});

// Sets up the id property to be dependent on the primary key.
var initType = function ( Type ) {
    var primaryKey = Type.primaryKey,
        metadata, dependents;
    if ( primaryKey !== 'id' ) {
        metadata = NS.meta( Type.prototype, false );
        dependents = metadata.dependents;
        if ( !metadata.hasOwnProperty( 'dependents' ) ) {
            dependents = metadata.dependents = NS.clone( dependents );
            metadata.allDependents = {};
        }
        ( dependents[ primaryKey ] ||
            ( dependents[ primaryKey ] = [] ) ).push( 'id' );
    }
    Type.isInited = true;
};

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
            storeKey - {String} (optional) The unique id for this record in the
                       store. If ommitted, a new record will be created, which
                       can then be committed to the store using the
                       <O.Record#saveToStore> method.
    */
    init: function ( store, storeKey ) {
        // Need to make sure special 'id' property triggers observers whenever
        // it changes
        var Type = this.constructor;
        if ( !Type.isInited ) {
            initType( Type );
        }
        if ( !storeKey ) {
            this._data = {};
        }
        this.store = store;
        this.storeKey = storeKey;
        Record.parent.init.call( this );
    },

    /**
        Property: O.Record#store
        Type: O.Store

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
        var storeKey = this.get( 'storeKey' );
        return storeKey ?
            this.get( 'store' ).getStatus( storeKey ) : NS.Status.READY;
    }.property().nocache(),

    /**
        Method: O.Record#is

        Checks whether record has a particular status. You can also supply a
        union of statuses (e.g. `record.is(O.Status.OBSOLETE|O.Status.DIRTY)`),
        in which case it will return true if the record has *any* of these
        status bits set.

        Parameters:
            state - {O.Status} The status to check.

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
        var storeKey = this.get( 'storeKey' );
        if ( storeKey ) { this.get( 'store' ).setObsolete( storeKey ); }
        return this;
    },

    /**
        Method: O.Record#setLoading

        Adds <O.Status.LOADING> to the current status value.

        Returns:
            {O.Record} Returns self.
    */
    setLoading: function () {
        var storeKey = this.get( 'storeKey' );
        if ( storeKey ) { this.get( 'store' ).setLoading( storeKey ); }
        return this;
    },

    /**
        Property: O.Record#id
        Type: String

        The record id. It's fine to override this with an attribute, provided it
        is the primary key. If the primary key for the record is not called
        'id', you must not override this property.
    */
    id: function () {
        var storeKey = this.get( 'storeKey' );
        return storeKey ?
            this.get( 'store' ).getIdFromStoreKey( storeKey ) ||
            ( '#' + storeKey ):
            this.get( this.constructor.primaryKey );
    }.property(),

    toJSON: function () {
        return this.get( 'id' );
    },

    /**
        Method: O.Record#saveToStore

        Saves the record to the store. Will then be committed back by the store
        according to the store's policy. Note, only a record not currently
        created in its store can do this; an error will be thrown if this method
        is called for a record already created in the store.

        Returns:
            {O.Record} Returns self.
    */
    saveToStore: function () {
        if ( this.get( 'storeKey' ) ) {
            throw new Error( "Record already created in store." );
        }
        var Type = this.constructor,
            data = this._data,
            store = this.get( 'store' ),
            idPropKey = Type.primaryKey,
            idAttrKey = this[ idPropKey ].key || idPropKey,
            storeKey = store.getStoreKey( Type, data[ idAttrKey ] ),
            attrs = NS.meta( this, true ).attrs,
            attrKey, propKey, attribute, defaultValue;

        delete this._data;

        // Fill in any missing defaults
        for ( attrKey in attrs ) {
            propKey = attrs[ attrKey ];
            if ( propKey ) {
                attribute = this[ propKey ];
                if ( !( attrKey in data ) ) {
                    defaultValue = attribute.defaultValue;
                    if ( defaultValue !== undefined ) {
                        data[ attrKey ] = defaultValue && defaultValue.toJSON ?
                            defaultValue.toJSON() : NS.clone( defaultValue );
                    }
                }
                if ( attribute.willCreateInStore ) {
                    attribute.willCreateInStore( this, propKey, storeKey );
                }
            }
        }

        // Save to store
        store.createRecord( storeKey, data )
             .setRecordForStoreKey( storeKey, this );

        // And save store reference on record instance.
        return this.set( 'storeKey', storeKey );
    },

    /**
        Method: O.Record#discardChanges

        Reverts the attributes in the record to the last committed state. If
        the record has never been committed, this will destroy the record.

        Returns:
            {O.Record} Returns self.
    */
    discardChanges: function () {
        var Status = NS.Status;
        if ( this.get( 'status' ) === (Status.READY|Status.NEW) ) {
            this.destroy();
        } else {
            var storeKey = this.get( 'storeKey' );
            if ( storeKey ) {
                this.get( 'store' ).revertData( storeKey );
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
        var storeKey = this.get( 'storeKey' );
        if ( storeKey ) { this.get( 'store' ).fetchData( storeKey ); }
        return this;
    },

    /**
        Method: O.Record#destroy

        Destroy the record. This will inform the store, which will commit it to
        the source.
    */
    destroy: function () {
        var storeKey = this.get( 'storeKey' );
        if ( storeKey && this.get( 'isEditable' ) ) {
            this.get( 'store' ).destroyRecord( storeKey );
        }
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
        Property: O.Record#isEditable
        Type: Boolean
        Default: True

        May the contact be edited/deleted?
    */
    isEditable: true,

    /**
        Property: O.Record#isValid
        Type: Boolean

        Are all the attributes are in a valid state?
    */
    isValid: function ( value ) {
        return ( value !== undefined ) ? value :
            !this.get( 'errorForAttribute' ).get( 'errorCount' );
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

}( this.O ) );
