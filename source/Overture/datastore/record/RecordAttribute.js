import { Class, meta, clone, isEqual } from '../../core/Core.js';

const instanceOf = function ( value, Type ) {
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

const attributeErrorsObserver = {
    object: null,
    method: 'notifyAttributeErrors',
};
const addValidityObserver = function ( observers, propKey ) {
    let keyObservers = observers[ propKey ];
    if ( keyObservers && keyObservers.contains( attributeErrorsObserver ) ) {
        return;
    }
    if ( !observers.hasOwnProperty( propKey ) ) {
        keyObservers = observers[ propKey ] = keyObservers ?
            keyObservers.slice() : [];
    }
    keyObservers.push( attributeErrorsObserver );
};

/**
    Class: O.RecordAttribute

    Represents an attribute on a record.
*/
const RecordAttribute = Class({

    __setupProperty__( metadata, propKey, object ) {
        let attrs = metadata.attrs,
            dependents, observers, dependencies, l, key,
            RecordType, AttributeErrorsType;
        if ( !metadata.hasOwnProperty( 'attrs' ) ) {
            attrs = metadata.attrs = attrs ? Object.create( attrs ) : {};
        }
        if ( this.isPrimaryKey ) {
            object.constructor.primaryKey = propKey;
            // Make the `id` property depend on the primary key.
            dependents = metadata.dependents;
            if ( !metadata.hasOwnProperty( 'dependents' ) ) {
                dependents = metadata.dependents = clone( dependents );
                metadata.allDependents = {};
            }
            ( dependents[ propKey ] ||
                ( dependents[ propKey ] = [] ) ).push( 'id' );
        }
        attrs[ this.key || propKey ] = propKey;
        object.constructor.clientSettableAttributes = null;

        if ( this.validate ) {
            observers = metadata.observers;
            addValidityObserver( observers, propKey );

            dependencies = this.validityDependencies;
            if ( dependencies ) {
                RecordType = object.constructor;
                AttributeErrorsType = object.AttributeErrorsType;
                if ( AttributeErrorsType.forRecordType !== RecordType ) {
                    AttributeErrorsType = object.AttributeErrorsType =
                        Class({
                            Extends: AttributeErrorsType,
                        });
                    AttributeErrorsType.forRecordType = RecordType;
                    metadata = meta( AttributeErrorsType );
                    dependents = metadata.dependents =
                        clone( metadata.dependents );
                } else {
                    metadata = meta( AttributeErrorsType );
                    dependents = metadata.dependents;
                }
                l = dependencies.length;
                while ( l-- ) {
                    key = dependencies[l];
                    if ( !dependents[ key ] ) {
                        dependents[ key ] = [];
                        addValidityObserver( observers, key );
                    }
                    dependents[ key ].push( propKey );
                }
            }
        }
    },

    __teardownProperty__( metadata, propKey, object ) {
        let attrs = metadata.attrs;
        if ( !metadata.hasOwnProperty( 'attrs' ) ) {
            attrs = metadata.attrs = Object.create( attrs );
        }
        attrs[ this.key || propKey ] = null;
        object.constructor.clientSettableAttributes = null;
    },

    /**
        Constructor: O.RecordAttribute

        Parameters:
            mixin - {Object} (optional) Override the default properties.
    */
    init( mixin ) {
        Object.assign( this, mixin );
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
        Property: O.RecordAttribute#isPrimaryKey
        Type: Boolean
        Default: true

        If true, this is the primary key for the record.
    */
    isPrimaryKey: false,

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
    willSet( propValue, propKey, record ) {
        if ( !record.get( 'isEditable' ) ) {
            return false;
        }
        if ( propValue === null ) {
            if ( !this.isNullable ) {
                return false;
            }
        }
        else if ( this.Type && !instanceOf( propValue, this.Type ) ) {
            throw new Error(
                'Incorrect value type for record attribute: \n' +
                'key: ' + propKey + '\n' +
                'value: ' + propValue
            );
        }
        return true;
    },

    /**
        Property: O.RecordAttribute#toJSON
        Type: *
        Default: null|(*,String,O.Record)->*

        If set, this function will be used to convert the property to a
        JSON-compatible representation. The function will be called as a method
        on the RecordAttribute object, and passed the following arguments:

        propValue - {*} The value to convert.
        propKey   - {String} The name of the attribute.
        record    - {O.Record} The record the attribute is being set on or
                    got from.
    */
    toJSON: null,

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
            {O.ValidationError} An object describing the error if this is not a
            valid value for the attribute. Otherwise, returns null if the value
            is valid.
    */
    validate: null,

    /**
        Property: O.RecordAttribute#validityDependencies
        Type: String[]|null
        Default: null

        Other properties the validity depends on. The attribute will be
        revalidated if any of these properties change. Note, chained
        dependencies are not automatically calculated; you must explicitly state
        all dependencies.

        NB. This is a list of the names of the properties as used on the
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
    call( record, propValue, propKey ) {
        const store = record.get( 'store' );
        const storeKey = record.get( 'storeKey' );
        const data = storeKey ? store.getData( storeKey ) : record._data;
        let attrKey, attrValue, currentAttrValue, update, Type;
        if ( data ) {
            attrKey = this.key || propKey;
            currentAttrValue = data[ attrKey ];
            if ( propValue !== undefined &&
                    this.willSet( propValue, propKey, record ) ) {
                if ( this.toJSON ) {
                    attrValue = this.toJSON( propValue, propKey, record );
                } else if ( propValue && propValue.toJSON ) {
                    attrValue = propValue.toJSON();
                } else {
                    attrValue = propValue;
                }
                if ( !isEqual( attrValue, currentAttrValue ) ) {
                    if ( storeKey ) {
                        update = {};
                        update[ attrKey ] = attrValue;
                        store.updateData( storeKey, update,
                            !( this.noSync || record._noSync ) );
                        store.fire( 'record:user:update', { record: this } );
                    } else {
                        data[ attrKey ] = attrValue;
                        record.computedPropertyDidChange( propKey, propValue );
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
    },
});

export default RecordAttribute;
