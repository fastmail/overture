// -------------------------------------------------------------------------- \\
// File: RecordAttribute.js                                                   \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Record.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var instanceOf = function ( value, Type ) {
    switch ( typeof value ) {
        case 'string':
            return Type === String;
        case 'boolean':
            return Type === Boolean;
        case 'number':
            return Type === Number;
    }
    return value instanceof Type;
};

/**
    Class: O.RecordAttribute

    Represents an attribute on a record.
*/
var RecordAttribute = NS.Class({

    __setupProperty__: function ( metadata, propKey ) {
        var attrs = metadata.attrs;
        if ( !metadata.hasOwnProperty( 'attrs' ) ) {
            attrs = metadata.attrs = attrs ? Object.create( attrs ) : {};
        }
        attrs[ this.key || propKey ] = propKey;
    },

    __teardownProperty__: function ( metadata, propKey ) {
        metadata.attrs[ this.key || propKey ] = null;
    },

    /**
        Constructor: O.RecordAttribute

        Parameters:
            mixin - {Object} (optional) Override the default properties.
    */
    init: function ( mixin ) {
        NS.extend( this, mixin );
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
        Property: O.RecordAttribute#Type
        Type: Constructor
        Default: null

        If a type is set and it has a fromJSON method, this will be used to
        convert values from the underlying data object when the attribute is
        fetched.
    */
    Type: null,

    /**
        Property: O.RecordAttribute#isNullable
        Type: Boolean
        Default: true

        If false, attempts to set null for the value will throw an error.
    */
    isNullable: true,

    /**
        Property: O.RecordAttribute#key
        Type: {String|null}
        Default: null

        The key to use on the JSON object for this attribute. If not set, will
        use the same key as the property name on the record.
    */
    key: null,

    /**
        Method: O.RecordAttribute#willSet

        This function is used to check the value being set is permissible. By
        default, it checks that the value is not null (or the <#isNullable>
        property is true), and that the value is of the correct type (if the
        <#Type> property is set). An error is thrown if the value is of a
        different type.

        You could override this function to, for example, only allow values that
        pass a strict validation to be set.

        Parameters:
            propValue - {*} The value being set.
            propKey   - {String} The name of the attribute.

        Returns:
            {Boolean} May the value be set?
    */
    willSet: function ( propValue, propKey, record ) {
        if ( !record.get( 'isEditable' ) ) {
            return false;
        }
        if ( propValue === null ) {
            if ( !this.isNullable ) {
                return false;
            }
        }
        else if ( this.Type && !instanceOf( propValue, this.Type ) ) {
            throw new Error( "Incorrect value type for record attribute" );
        }
        return true;
    },

    /**
        Property: O.RecordAttribute#defaultValue
        Type: *
        Default: undefined

        If the attribute is not set on the underlying data object, the
        defaultValue will be returned instead. This will also be used to add
        this attribute to the data object if a new record is created and the
        attribute is not set.

        The value should be of the type specified in <O.RecordAttribute#Type>.
    */
    defaultValue: undefined,

    /**
        Method: O.RecordAttribute#validate

        Tests whether the value to be set is valid.

        Parameters:
            propValue   - {*} The value being set. This is the real value, not
                          the serialised version for JSON (if different).
            propKey     - {String} The name of the attribute on the record.
            record      - {O.Record} The record on which the value is being set.

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
        revalidated if any of these attributes change. Note, chained
        dependencies are not automatically calculated; you must explicitly state
        all dependencies.

        NB. This is a list of the names of the attributes as used on the
        objects, not necessarily that of the underlying keys used in the JSON
        data object.
    */
    validityDependencies: null,

    /**
        Method: O.RecordAttribute#call

        Gets/sets the attribute.

        Parameters:
            record    - {O.Record} The record the attribute is being set on or
                        got from.
            propValue - {*} The value being set (undefined if just a 'get').
            propKey   - {String} The name of the attribute on the record.

        Returns:
            {*} The attribute.
    */
    call: function ( record, propValue, propKey ) {
        var store = record.get( 'store' ),
            storeKey = record.get( 'storeKey' ),
            data = storeKey ? store.getData( storeKey ) : record._data,
            attrKey, attrValue, currentAttrValue, update, Type;
        if ( data ) {
            attrKey = this.key || propKey;
            currentAttrValue = data[ attrKey ];
            if ( propValue !== undefined &&
                    this.willSet( propValue, propKey, record ) ) {
                attrValue = propValue && propValue.toJSON ?
                    propValue.toJSON() : propValue;
                if ( !NS.isEqual( attrValue, currentAttrValue ) ) {
                    if ( storeKey ) {
                        update = {};
                        update[ attrKey ] = attrValue;
                        store.updateData( storeKey, update,
                            !( this.noSync || record._noSync ) );
                    } else {
                        data[ attrKey ] = attrValue;
                        record.computedPropertyDidChange( propKey );
                        if ( this.validate ) {
                            record.get( 'errorForAttribute' ).set( propKey,
                                this.validate( propValue, propKey, record ) );
                        }
                    }
                }
                return propValue;
            }
            Type = this.Type;
        }
        return currentAttrValue !== undefined ?
            currentAttrValue !== null && Type && Type.fromJSON ?
                Type.fromJSON( currentAttrValue ) : currentAttrValue :
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
    data object. This will automatically set things up so they are fetched from
    the store and synced to the source.

    Parameters:
        Type    - {Constructor} The type of the property.
        mixin - {Object} Properties to pass to the <O.RecordAttribute>
                constructor.

    Returns:
        {O.RecordAttribute} Getter/setter for that record attribute.
*/
NS.Record.attr = function ( Type, mixin ) {
    if ( !mixin ) { mixin = {}; }
    if ( Type && !mixin.Type ) { mixin.Type = Type; }
    return new RecordAttribute( mixin );
};

}( this.O ) );
