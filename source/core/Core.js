/**
    Module: Core

    The Core module defines 'O', the global namespace to contain this library,
    and augments it with a few helper methods. It also contains extensions to
    the default types and class creation functionality.
*/

/**
    Function: O.meta

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
                    corresponding call to
                    <O.ObservableProps#endPropertyChanges>.
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

const Metadata = function ( object ) {
    this.object = object;
    this.dependents = {};
    this.allDependents = {};
    this.cache = {};
    this.observers = {};
    this.changed = null;
    this.depth = 0;
    this.pathObservers = {};
    this.bindings = {};
    this.inits = {};
    this.isInitialised = false;

    object.__meta__ = this;
};

const meta = function ( object ) {
    let data = object.__meta__;
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
        data.object = object;

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

        object.__meta__ = data;
    }
    return data;
};

/**
    Function: O.guid

    Returns a unique ID (within the scope of this instance of the application)
    for the item passed in.

    Parameters:
        item - {*} The item to get an id for.

    Returns:
        {String} The id for the item.
*/
const guids = new WeakMap();
let nextGuid = 0;
const guid = function ( item ) {
    if ( item === null ) {
        return 'null';
    }
    switch ( typeof item ) {
        case 'boolean':
            return item ? 'true' : 'false';
        case 'number':
            return 'num:' + item.toString( 36 );
        case 'string':
            return 'str:' + item;
        case 'undefined':
            return 'undefined';
    }
    if ( item instanceof Date ) {
        return 'date:' + (+item);
    }

    let guid = item.__guid__ || guids.get( item );
    if ( !guid ) {
        guid = 'id:' + nextGuid.toString( 36 );
        nextGuid += 1;
        guids.set( item, guid );
    }
    return guid;
};

/**
    Function: O.mixin

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
const mixin = function ( object, extras, doNotOverwrite ) {
    if ( extras ) {
        const force = !doNotOverwrite;
        let metadata;

        for ( const key in extras ) {
            if ( key !== '__meta__' &&
                    ( force || !object.hasOwnProperty( key ) ) ) {
                const old = object[ key ];
                const value = extras[ key ];
                if ( old && old.__teardownProperty__ ) {
                    if ( !metadata ) {
                        metadata = meta( object );
                    }
                    old.__teardownProperty__( metadata, key, object );
                }
                if ( value && value.__setupProperty__ ) {
                    if ( !metadata ) {
                        metadata = meta( object );
                    }
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

    DEPRECATED. Use {Object.assign( base, extras )} instead. Caution: there is
    a difference in semantics: `Object.assign` essentially has `doNotOverride`
    turned off. But frankly, this is what you need in most cases.

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
const extend = function ( base, extras, doNotOverwrite ) {
    if ( window.console && console.warn ) {
        console.warn( 'O.extend is deprecated' );
    }
    for ( const key in extras ) {
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
const merge = function ( base, extras ) {
    for ( const key in extras ) {
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
const clone = function ( value ) {
    let cloned = value;
    if ( value && typeof value === 'object' ) {
        if ( value instanceof Array ) {
            cloned = [];
            let l = value.length;
            while ( l-- ) {
                cloned[l] = clone( value[l] );
            }
        } else if ( value instanceof Date ) {
            cloned = new Date( value );
        } else {
            cloned = {};
            for ( const key in value ) {
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
const isEqual = function ( a, b ) {
    if ( a === b ) {
        return true;
    }
    if ( a && b && typeof a === 'object' && typeof b === 'object' ) {
        if ( a instanceof Array ) {
            if ( b instanceof Array && a.length === b.length ) {
                const aLength = a.length;
                for ( let i = 0; i < aLength; i += 1 ) {
                    if ( !isEqual( a[i], b[i] ) ) {
                        return false;
                    }
                }
                return true;
            }
        } else if ( a instanceof Date ) {
            return ( +a === +b );
        } else {
            const constructor = a.constructor;
            if ( a.constructor !== b.constructor ) {
                return false;
            }
            if ( constructor.isEqual ) {
                return constructor.isEqual( a, b );
            }
            for ( const key in a ) {
                if ( !isEqual( a[ key ], b[ key ] ) ) {
                    return false;
                }
            }
            for ( const key in b ) {
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

        > const MyClass = O.Class({ sayBoo: function (){ alert( 'boo' ); } });
        > let instance = new MyClass();
        > instance.sayBoo(); // Alerts 'boo'.

    Parameters:
        params - {Object} An object containing methods or properties
                 to configure this class.

    Returns:
        {Constructor} The constructor function for the new class.
*/
const Class = function ( params ) {
    const parent = params.Extends;
    if ( 'Extends' in params && typeof parent !== 'function' ) {
        throw new Error( 'Bad O.Class definition: Extends is ' + parent );
    }
    let mixins = params.Mixin;
    const init = params.init || ( parent ?
            function () {
                parent.apply( this, arguments );
            } :
            function () {} );

    if ( parent ) {
        const proto = parent.prototype;
        init.parent = proto;
        init.prototype = Object.create( proto );
        init.prototype.constructor = init;
        delete params.Extends;
    }

    if ( mixins ) {
        if ( !( mixins instanceof Array ) ) {
            mixins = [ mixins ];
        }
        for ( let i = 0, l = mixins.length; i < l; i += 1 ) {
            mixin( init.prototype, mixins[i], false );
        }
        delete params.Mixin;
    }

    mixin( init.prototype, params, false );

    return init;
};

/**
    Method: Function#implement

    Adds a set of methods or other properties to the prototype of a function, so
    all instances will have access to them.

    DEPRECATED. Use {Object.assign( this.prototype, methods )} instead.
    Caution: there is a difference in semantics: `Object.assign` essentially
    has `force` turned on. But frankly, this is what you need in most cases.
    Also, if you were using this method to add anything but functions,
    (a) why were you doing that? and
    (b) you’ll need to use {mixin( this.prototype, methods, !force )} instead.

    Parameters:
        methods - {Object} The methods or properties to add to the prototype.
        force   - {Boolean} Unless this is true, existing methods/properties
                  will not be overwritten.

    Returns:
        {Function} Returns self.
*/
Function.prototype.implement = function ( methods, force ) {
    if ( window.console && console.warn ) {
        console.warn( 'Function#implement is deprecated' );
    }
    mixin( this.prototype, methods, !force );
    return this;
};

/**
    Method: Function#extend

    Adds a set of static methods/properties to the function.

    DEPRECATED. Use {Object.assign( this, methods )} instead.
    Caution: there is a difference in semantics: `Object.assign` essentially
    has `force` turned on. But frankly, this is what you need in most cases.

    Parameters:
        methods - {Object} The methods/properties to add.
        force   - {Boolean} Unless this is true, existing methods/properties
                  will not be overwritten.

    Returns:
        {Function} Returns self.
*/
Function.prototype.extend = function ( methods, force ) {
    if ( window.console && console.warn ) {
        console.warn( 'Function#extend is deprecated' );
    }
    extend( this, methods, !force );
    return this;
};

export { meta, guid, mixin, extend, merge, clone, isEqual, Class };

// TODO(cmorgan/modulify): do something about these exports: Function#implement,
// Function#extend
