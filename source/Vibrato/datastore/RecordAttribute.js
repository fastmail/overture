// -------------------------------------------------------------------------- \\
// File: RecordAttribute.js                                                   \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Record.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */
 
"use strict";

( function ( NS, undefined ) {

var instanceOf = function ( value, type ) {
    switch ( typeof value ) {
        case 'string':
            return type === String;
        case 'boolean':
            return type === Boolean;
        case 'number':
            return type === Number;
    }
    return value instanceof type;
};

/**
    Class: O.RecordAttribute

    Represents an attribute on a record.
*/
var RecordAttribute = NS.Class({
    
    __setupProperty__: function ( metadata, key ) {
        var attrs = metadata.attrs;
        if ( !metadata.hasOwnProperty( 'attrs' ) ) {
            attrs = metadata.attrs = attrs ? attrs.slice() : [];
        }
        attrs.push( key );
    },
    
    __teardownProperty__: function ( metadata, key ) {
        metadata.attrs.erase( key );
    },
    
    /**
        Constructor: O.RecordAttribute
        
        Parameters:
            options - {Object} (optional) Override the default properties.
    */
    init: function ( options ) {
        NS.extend( this, options );
    },
    
    /**
        Property (private): O.RecordAttribute#isProperty
        Type: Boolean
        Default: true
        
        Record attributes are computed properties.
    */
    isProperty: true,
    /**
        Property (private): O.RecordAttribute#isVolatile
        Type: Boolean
        Default: false
        
        Record attributes should be cached.
    */
    isVolatile: false,
    /**
        Property (private): O.RecordAttribute#isSilent
        Type: Boolean
        Default: true
        
        Store will handle firing computedPropertyIsChanged on record.
    */
    isSilent: true,
    
    /**
        Property: O.RecordAttribute#noSync
        Type: Boolean
        Default: false
        
        If set to true, changes will not be propagated back to the source.
    */
    noSync: false,
    
    /**
        Property: O.RecordAttribute#type
        Type: Constructor
        Default: null
        
        If a type is set and it has a fromJSON method, this will be used to
        convert values from the underlying hash when the attribute is fetched.
    */
    type: null,
    
    /**
        Property: O.RecordAttribute#isNullable
        Type: Boolean
        Default: true
        
        If false, attempts to set null for the value will throw an error.
    */
    isNullable: true,
    
    /**
        Method: O.RecordAttribute#willSet
        
        Parameters:
            value - {*} The value being set.
            key   - {String} The name of the attribute.
        
        This function is used to check the value being set is permissible. By
        default, it checks that the value is not null (or the <#isNullable>
        property is true), and that the value is of the correct type (if the
        <#type> property is set). An error is thrown if the value is of a
        different type.
        
        You could override this function to, for example, only allow values that
        pass a strict validation to be set.
        
        Returns:
            {Boolean} May the value be set?
    */
    willSet: function ( value, key ) {
        if ( value === null ) {
            if ( !this.isNullable ) {
                return false;
            }
        }
        else if ( this.type && !instanceOf( value, this.type ) ) {
            throw "Incorrect value type for record attribute";
        }
        return true;
    },
    
    /**
        Property: O.RecordAttribute#defaultValue
        Type: *
        Default: undefined
        
        If the attribute is not set on the underlying hash, the defaultValue
        will be returned instead. This will also be used to add this attribute
        to the hash if a new record is created and the attribute is not set.
        
        The value should be of the type specified in <O.RecordAttribute#type>.
    */
    defaultValue: undefined,
    
    /**
        Method: O.RecordAttribute#validate
        
        Parameters:
            value  - {*} The value being set.
            key    - {String} The name of the attribute.
            record - {O.Record} The record the value is being set on.
        
        Tests whether the value to be set is valid.
        
        Returns:
            {String} A string describing the error if this is not a valid value
            for the attribute. Otherwise, returns the empty string if the value
            is valid.
    */
    validate: null,

    /**
        Property: O.RecordAttribute#validityDependencies
        Type: Array.<String>|null
        Default: null

        Other attributes the validity depends on. The attribute will be
        revalidated if any of these attributes change.
    */
    validityDependencies: null,
    
    /**
        Method: O.RecordAttribute#call
        
        Parameters:
            record - {O.Record} The record the attribute is being set on or got
                     from.
            value  - {*} The value being set (undefined if just a 'get').
            key    - {String} The name of the attribute.
        
        Gets/sets the attribute.
        
        Returns:
            {*} The attribute.
    */
    call: function ( record, value, key ) {
        var store = record.get( 'store' ),
            storeKey = store ? record.get( 'storeKey' ) : '',
            hash = store ?
                store.getHash( storeKey ) :
                record._hash || ( record._hash = {} ),
            currentValue, attrValue, update, type;
        if ( hash ) {
            currentValue = hash[ key ];
            if ( value !== undefined && this.willSet( value, key ) ) {
                attrValue = value && value.toJSON ? value.toJSON() : value;
                if ( attrValue !== currentValue ) {
                    if ( store ) {
                        update = {};
                        update[ key ] = attrValue;
                        store.updateHash( storeKey, update,
                            !( this.noSync || record._noSync ) );
                    } else {
                        hash[ key ] = attrValue;
                        record.computedPropertyDidChange( key );
                    }
                    if ( this.validate ) {
                        record.get( 'errorForAttribute' ).set( key,
                            this.validate( value, key, record ) );
                    }
                }
                return value;
            }
            type = this.type;
        }
        return currentValue !== undefined ?
            type && type.fromJSON ?
                type.fromJSON( currentValue ) : currentValue :
            this.defaultValue;
    }
});

NS.RecordAttribute = RecordAttribute;

/**
    Function: O.Record.attr
    
    A factory function for creating a new <O.RecordAttribute> instance. This
    will set an assert function to verify the correct type is being set whenever
    the value is set, and that the correct type is used to serialise to/from
    primitive types.
    
    When subclassing O.Record, use this function to create a value for any
    properties on the record which correspond to properties on the underlying
    data hash. This will automatically set things up so they are fetched from
    the store and synced to the source.
    
    Parameters:
        type    - {Constructor} The type of the property.
        options - {Object} Options to pass to the <O.RecordAttribute>
                  constructor.
    
    Returns:
        {O.RecordAttribute} Getter/setter for that record attribute.
*/
NS.Record.attr = function ( type, options ) {
    if ( !options ) { options = {}; }
    if ( type && !options.type ) { options.type = type; }
    return new RecordAttribute( options );
};

}( O ) );