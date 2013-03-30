// -------------------------------------------------------------------------- \\
// File: Core.js                                                              \\
// Module: Core                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global module */

"use strict";

/**
    Module: Core

    The Core module defines 'O', the global namespace to contain this library,
    and augments it with a few helper methods. It also contains extensions to
    the default types and class creation functionality.
*/

( function ( NS ) {

/**
    Namespace: O

    The only new global variable introduced by the library. All Classes and
    Functions are stored under this namespace.
*/
// For Node.
if ( typeof module === 'object' ) {
    module.exports = NS;
}

/**
    Method: O.meta

    Returns an object representing the metadata for the given object. This has
    the following properties:

    object        - The original object the metadata is for. A metadata object
                    may be shared with other objects for which the original
                    object is the prototype until they need to write to it. This
                    reference is used to detect whether the metadata is
                    inherited, as it's quicker than using Object#hasOwnProperty.
    dependents    - A mapping of keys in the object to computed properties that
                    depend on them. This only maps to direct dependents and is
                    constructed as the computed properties are added to the
                    object. This is shared with the prototype object (even after
                    a separate metadata object has been created) until a new
                    computed property is added or removed from the object, at
                    which point it is cloned so the modifications do not affect
                    the parent object.
    allDependents - A mapping of keys in the object to the full set of computed
                    properties that depend on them, even indirectly. This is
                    shared with the prototype object (even after a separate
                    metadata object has been created) until a new computed
                    property is added or removed from the object.
                    The allDependents map is calculated lazily as required; you
                    should use the <O.ComputedProps#propertiesDependentOnKey>
                    method to fetch the list.
    cache         - A mapping of keys to the last returned value of cacheable
                    computed properties.
    observers     - A mapping of keys to an array of observers for that key.
                    Event listeners are also in  here, mapped from a key of
                    '__event__' + the event type.
    changed       - Null, or if the depth property is >1, an object mapping keys
                    or properties that have changed value, to an object holding
                    the old and possibly the new value.
    depth         - The number of calls to
                    <O.ObservableProps#beginPropertyChanges> without a
                    corresponding call to <O.ObservableProps#endPropertyChanges>.
    pathObservers - A mapping of keys to a list of paths they observe.
    bindings      - A mapping of keys to Binding objects.
    inits         - A mapping of mixin names to a reference count of the number
                    of properties requiring a call to its init/destroy methods.
    isInitialised - Boolean: have the necessary init methods been called?

    For example:

        {
            object: {
                w: O.bind( 'z.b' ),
                x: 5,
                y: function () {
                    return this.get( 'x' ) * 2;
                }.property( 'x' ),
                z: function () {
                    [...]
                }.property( 'y' ),
                onX: function () {
                    [...]
                }.observes( 'x', 'z.a' )
            },
            dependents: {
                x: [ 'y' ],
                y: [ 'z' ]
            },
            allDependents: {
                x: [ 'y', 'z' ]
                // Note, in this example 'y' has not yet been calculated, since
                // it has not been required yet.
            },
            cache: {
                y: 10
            },
            observers: {
                x: [ { object: null, method: 'onX' } ]
            },
            changed: null,
            depth: 0,
            pathObservers: {
                onX: [ 'z.a' ]
            },
            bindings: {
                w: Binding
            },
            inits: {
                Bindings: 1,
                Observers: 1
            },
            isInitialised: true
        }

    Parameters:
        object - {Object} The object to fetch the metadata for.

    Returns:
        {Object} The metadata for the object.
*/

var Metadata = function ( object ) {
    this.dependents = {};
    this.allDependents = {};
    this.cache = {};
    this.observers = {};
    this.changed = null;
    this.depth = 0;
    this.pathObservers = {};
    this.bindings = {};
    this.inits = {};
    this.object = object;
    this.isInitialised = false;

    object.__meta__ = this;
};

var meta = NS.meta = function ( object ) {
    var data = object.__meta__;
    if ( !data ) {
        data = new Metadata( object );
    } else if ( data.object !== object ) {
        // Until the set of computed properties on the object changes, the
        // 'dependents' information is identical to that of the parent so
        // can be shared. The computed 'allDependents will be calculated
        // when needed and stored in the parent meta object, so be available
        // to all other objects of the same type. The dependents property
        // is copied on write (and the allDependents then reset and
        // calculated separately for the object).
        data = Object.create( data );

        // The cache should always be separate.
        data.cache = {};

        // Inherit observers, bindings and init/destructors.
        // The individual properties in these objects will be copied on
        // write, leaving any unaltered properties shared with the parent.
        // Path observers are rare enough that we don't waste time and space
        // creating a new object here, but rather wait until a write is made
        // to data.pathObservers, at which point the inheriting object is
        // created.
        data.observers = Object.create( data.observers );
        data.changed = null;
        data.depth = 0;
        data.bindings = Object.create( data.bindings );
        data.inits = Object.create( data.inits );
        data.object = object;
        object.__meta__ = data;
    }
    return data;
};

/**
    Method: O.guid

    Returns a unique ID (within the scope of this instance of the application)
    for the item passed in.

    Parameters:
        item - {*} The item to get an id for.

    Returns:
        {String} The id for the item.
*/
var guid = 0;
NS.guid = function ( item ) {
    var type = typeof item;
    return ( type === 'object' || type === 'function' ) ?
        item.__guid__ || ( item.__guid__ = '(id:' + ( guid += 1 ) + ')' ) :
        '(' + type + ':' + item + ')';
};

/**
    Method: O.mixin

    Add properties to an object, doing the necessary setup and teardown to
    ensure special properties (computed, bound, observed etc.), are registered
    correctly.

    Parameters:
        object         - {Object} The object to add properties to.
        extras         - {Object} The extra properties to add.
        doNotOverwrite - {Boolean} If true, if there is a existing property in
                         object with the same name as one in extras, it won't be
                         added to the object.

    Returns:
        {Object} Returns the object parameter.
*/
var mix = NS.mixin = function ( object, extras, doNotOverwrite ) {
    if ( extras ) {
        var force = !doNotOverwrite,
            key, old, value, metadata;

        for ( key in extras ) {
            if ( key !== '__meta__' &&
                    ( force || !object.hasOwnProperty( key ) ) ) {
                old = object[ key ];
                value = extras[ key ];
                if ( old && old.__teardownProperty__ ) {
                    if ( !metadata ) { metadata = meta( object ); }
                    old.__teardownProperty__( metadata, key, object );
                }
                if ( value && value.__setupProperty__ ) {
                    if ( !metadata ) { metadata = meta( object ); }
                    value.__setupProperty__( metadata, key, object );
                }
                object[ key ] = value;
            }
        }
    }
    return object;
};

/**
    Function: O.extend

    Add all properties of one object to another, overwriting any existing
    properties with the same name, unless the doNotOverwrite parameter is set.
    Only adds properties actually on the object, not any properties on the
    prototype chain.

    Parameters:
        base           - {Object} The object to be extended.
        extras         - {Object} The object whose properties are to be added to
                         base.
        doNotOverwrite - {Boolan} (optional) If true, will not overwrite a
                         property on the base object with the property of the
                         same name on the extras object.

    Returns:
        {Object} Returns base.
*/
var extend = NS.extend = function ( base, extras, doNotOverwrite ) {
    for ( var key in extras ) {
        if ( extras.hasOwnProperty( key ) &&
                ( !doNotOverwrite || !base.hasOwnProperty( key ) ) ) {
            base[ key ] = extras[ key ];
        }
    }
    return base;
};

/**
    Function: O.merge

    Add all properties of one object to another, recursively merging if a key
    corresponds to another object on both 'base' and 'extras' objects. Only adds
    properties actually on the object, not any properties on the prototype
    chain.

    Parameters:
        base   - {Object} The object to be extended.
        extras - {Object} The object whose properties are to be merged into
                 base.

    Returns:
        {Object} Returns base.
*/
var merge = NS.merge = function ( base, extras ) {
    for ( var key in extras ) {
        if ( extras.hasOwnProperty( key ) ) {
            if ( base.hasOwnProperty( key ) &&
                    base[ key ] && extras[ key ] &&
                    typeof base[ key ] === 'object' &&
                    typeof extras[ key ] === 'object' ) {
                merge( base[ key ], extras[ key ] );
            } else {
                base[ key ] = extras[ key ];
            }
        }
    }
    return base;
};

/**
    Function: O.clone

    Creates a deep copy of a value. Only works on native JS types; do not use
    with DOM objects or custom objects.

    Parameters:
        value - {*} The value to be copied.

    Returns:
        {*} The clone of the value.
*/
var clone = NS.clone = function ( value ) {
    var cloned = value,
        l, key;
    if ( value && typeof value === 'object' ) {
        if ( value instanceof Array ) {
            cloned = [];
            l = value.length;
            while ( l-- ) {
                cloned[l] = clone( value[l] );
            }
        } else if ( value instanceof Date ) {
            cloned = new Date( value );
        } else {
            cloned = {};
            for ( key in value ) {
                cloned[ key ] = clone( value[ key ] );
            }
        }
    }
    return cloned;
};

/**
    Function: O.isEqual

    Compares two values to see if they are equal. Will *only* work with basic
    JavaScript types (i.e. the ones that can be encoded in JSON).

    Parameters:
        a - {*} The first value.
        b - {*} The second value.

    Returns:
        {Boolean} Are the values equal, i.e. are they identical primitives, or
        are the both arrays or objects with equal members?
*/
var isEqual = NS.isEqual = function ( a, b ) {
    var i, l, key;
    if ( a === b ) {
        return true;
    }
    if ( a && b && typeof a === 'object' && typeof b === 'object' ) {
        if ( a instanceof Array ) {
            if ( b instanceof Array && a.length === b.length ) {
                for ( i = 0, l = a.length; i < l; i += 1 ) {
                    if ( !isEqual( a[i], b[i] ) ) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            for ( key in a ) {
                if ( !isEqual( a[ key ], b[ key ] ) ) {
                    return false;
                }
            }
            for ( key in b ) {
                if ( !isEqual( a[ key ], b[ key ] ) ) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
};

/**
    Function: O.Class

    The Class function takes an object containing the instance functions for a
    new class and returns a constructor function with each of these methods in
    its prototype. It also supports inheritance and mixins, via the special
    Extends and Mixin properties respectively.

    The returned constructor function will be the init method passed in the
    params. If the prototype has no function with the name 'init', an empty
    function will be used, or if the class inherits, then the superclass init
    function will be called.

    For example:

        > var MyClass = O.Class({ sayBoo: function (){ alert( 'boo' ); } });
        > var instance = new MyClass();
        > instance.sayBoo(); // Alerts 'boo'.

    Parameters:
        params - {Object} An object containing methods or properties
                 to configure this class.

    Returns:
        {Constructor} The constructor function for the new class.
*/
NS.Class = function ( params ) {
    var parent = params.Extends,
        mixins = params.Mixin,
        init = params.init || ( parent ?
            function () { parent.apply( this, arguments ); } :
            function () {} ),
        proto, i, l;

    if ( parent ) {
        proto = parent.prototype;
        init.parent = proto;
        init.prototype = Object.create( proto );
        init.prototype.constructor = init;
        delete params.Extends;
    }

    if ( mixins ) {
        if ( !( mixins instanceof Array ) ) {
            mixins = [ mixins ];
        }
        for ( i = 0, l = mixins.length; i < l; i += 1 ) {
            init.implement( mixins[i], true );
        }
        delete params.Mixin;
    }

    init.implement( params, true );

    return init;
};

/**
    Function: O.sortByProperties

    Creates a comparison function which takes two objects and returns -1/0/1 to
    indicate whether the first object is before or after the other. Comparison
    is made by considering each of the properties in the array in turn on the
    two objects until the objects have non-equal values for a property. If the
    property values are integer like strings, they will first be converted to
    numbers for comparison. Other strings will be compared case-insensitively.

    Parameters:
        properties - {Array.<String>} The properties to sort the objects by, in
                     order of precedence. Can also supply just a String for one
                     property.

    Returns:
        {Function} This function may be passed to the Array#sort method to
        sort the array of objects by the properties specified.
*/
var isNumber = /^\d+$/;
NS.sortByProperties = function ( properties ) {
    if ( !( properties instanceof Array ) ) {
        properties = [ properties ];
    }
    var l = properties.length;

    return function ( a, b ) {
        var hasGet = !!a.get,
            i, prop, aVal, bVal, type;
        for ( i = 0; i < l; i += 1 ) {
            prop = properties[i];
            aVal = hasGet ? a.get( prop ) : a[ prop ];
            bVal = hasGet ? b.get( prop ) : b[ prop ];
            type = typeof aVal;

            // Must be the same type
            if ( type === typeof bVal ) {
                if ( type === 'boolean' && aVal !== bVal ) {
                    return aVal ? -1 : 1;
                }
                if ( type === 'string' ) {
                    if ( isNumber.test( aVal ) && isNumber.test( bVal ) ) {
                        aVal = parseInt( aVal, 10 );
                        bVal = parseInt( bVal, 10 );
                    } else {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }
                }
                if ( aVal < bVal ) {
                    return -1;
                }
                if ( aVal > bVal ) {
                    return 1;
                }
            }
        }
        return 0;
    };
};

/**
    Method: Function#implement

    Adds a set of methods or other properties to the prototype of a function, so
    all instances will have access to them.

    Parameters:
        methods - {Object} The methods or properties to add to the prototype.
        force   - {Boolean} Unless this is true, existing methods/properties
                  will not be overwritten.

    Returns:
        {Function} Returns self.
*/
Function.prototype.implement = function ( methods, force ) {
    mix( this.prototype, methods, !force );
    return this;
};

/**
    Method: Function#extend

    Adds a set of static methods/properties to the function.

    Parameters:
        methods - {Object} The methods/properties to add.
        force   - {Boolean} Unless this is true, existing methods/properties
                  will not be overwritten.

    Returns:
        {Function} Returns self.
*/
Function.prototype.extend = function ( methods, force ) {
    extend( this, methods, !force );
    return this;
};

}( this.O || ( this.O = {} ) ) );
