// -------------------------------------------------------------------------- \\
// File: ComputedProps.js                                                     \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

/**
    Module: Foundation

    The Foundation module provides the basic objects and mixins for key-value
    coding and observation as well as bindings and a run loop.
*/

var slice = Array.prototype.slice,
    meta = NS.meta;

var makeComputedDidChange = function ( key ) {
    return function () {
        this.computedPropertyDidChange( key );
    };
};

var setupComputed = function ( metadata, key, obj ) {
    var dependencies = this.dependencies,
        dependents = metadata.dependents,
        l, valueThisKeyDependsOn, method, pathObservers, methodObservers;

    if ( !metadata.hasOwnProperty( 'dependents' ) ) {
        dependents = metadata.dependents = NS.clone( dependents );
        metadata.allDependents = {};
    }
    l = dependencies.length;
    while ( l-- ) {
        valueThisKeyDependsOn = dependencies[l];
        if ( valueThisKeyDependsOn.indexOf( '.' ) === -1 ) {
            ( dependents[ valueThisKeyDependsOn ] ||
                ( dependents[ valueThisKeyDependsOn ] = [] ) ).push( key );
        } else {
            if ( !method ) {
                method = '__' + key + 'DidChange__';
                metadata.inits.Observers =
                    ( metadata.inits.Observers || 0 ) + 1;
            }
            if ( !obj[ method ] ) {
                obj[ method ] = makeComputedDidChange( key );
            }
            if ( !pathObservers ) {
                pathObservers = metadata.pathObservers;
                if ( !metadata.hasOwnProperty( 'pathObservers' ) ) {
                    pathObservers =
                        metadata.pathObservers = Object.create( pathObservers );
                }
                methodObservers = pathObservers[ method ];
                if ( !methodObservers ) {
                    methodObservers = pathObservers[ method ] = [];
                } else if ( !pathObservers.hasOwnProperty( method ) ) {
                    methodObservers =
                        pathObservers[ method ] = methodObservers.slice();
                }
            }
            methodObservers.push( valueThisKeyDependsOn );
        }
    }
};

var teardownComputed = function ( metadata, key ) {
    var dependencies = this.dependencies,
        dependents = metadata.dependents,
        l, valueThisKeyDependsOn, method, pathObservers, methodObservers;

    if ( !metadata.hasOwnProperty( 'dependents' ) ) {
        dependents = metadata.dependents = NS.clone( dependents );
        metadata.allDependents = {};
    }
    l = dependencies.length;
    while ( l-- ) {
        valueThisKeyDependsOn = dependencies[l];
        if ( valueThisKeyDependsOn.indexOf( '.' ) === -1 ) {
            dependents[ valueThisKeyDependsOn ].erase( key );
        } else {
            if ( !method ) {
                method = '__' + key + 'DidChange__';
                metadata.inits.Observers -= 1;
            }
            if ( !pathObservers ) {
                pathObservers = metadata.pathObservers;
                if ( !metadata.hasOwnProperty( 'pathObservers' ) ) {
                    pathObservers =
                        metadata.pathObservers = Object.create( pathObservers );
                }
                methodObservers = pathObservers[ method ];
                if ( !pathObservers.hasOwnProperty( method ) ) {
                    methodObservers =
                        pathObservers[ method ] = methodObservers.slice();
                }
            }
            methodObservers.erase( valueThisKeyDependsOn );
        }
    }
};

Function.implement({
    /**
        Method: Function#property

        Marks a function as a property getter/setter. If a call to
        <O.ComputedProps#get> or <O.ComputedProps#set> is made and the
        current value of the property is this method, the method will be called
        rather than just returned/overwritten itself.

        Normally, properties will only be dependent on other properties on the
        same object. You may also specify paths though, e.g. 'obj.obj2.prop' and
        this will also work, however if you do this the object (and all other
        objects in the path) *MUST* also include the <O.ObservableProps> mixin.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                       properties this value depends on; if any of these are
                       changed, the cached value for this property will be
                       invalidated.

        Returns:
            {Function} Returns self.
    */
    property: function () {
        this.isProperty = true;
        if ( arguments.length ) {
            this.dependencies = slice.call( arguments );
            this.__setupProperty__ = setupComputed;
            this.__teardownProperty__ = teardownComputed;
        }
        return this;
    },

    /**
        Method: Function#nocache

        Marks a getter method such that its value is not cached.

        Returns:
            {Function} Returns self.
    */
    nocache: function () {
        this.isVolatile = true;
        return this;
    },

    /**
        Method: Function#doNotNotify

        Marks a computed property so that when it is set,
        <O.ComputedProps#propertyDidChange> is not automatically called.

        Returns:
            {Function} Returns self.
    */
    doNotNotify: function () {
        this.isSilent = true;
        return this;
    }
});

/**
    Function: O.getFromPath

    Follows a path string (e.g. 'mailbox.messages.howMany') to retrieve the
    final object/value from a root object. At each stage of the path, if the current object supports a 'get' function, that will be used to retrieve the
    next stage, otherwise it will just be read directly as a property.

    If the full path cannot be followed, `undefined` will be returned.

    Parameters:
        root - {Object} The root object the path is relative to.
        path - {String} The path to retrieve the value from.

    Returns:
        {*} Returns the value at the end of the path.
*/
var isNum = /^\d+$/;
var getFromPath = NS.getFromPath = function ( root, path ) {
    var currentPosition = 0,
        pathLength = path.length,
        nextDot,
        key;
    while ( currentPosition < pathLength ) {
        if ( !root ) {
            return undefined;
        }
        nextDot = path.indexOf( '.', currentPosition );
        if ( nextDot === -1 ) { nextDot = pathLength; }
        key = path.slice( currentPosition, nextDot );
        root = root.getObjectAt && isNum.test( key ) ?
            root.getObjectAt( +key ) :
            root.get ?
                root.get( key ) :
                root[ key ];
        currentPosition = nextDot + 1;
    }
    return root;
};

/**
    Mixin: O.ComputedProps

    The ComputedProps mixin provides a generic get/set method for accessing
    and modifying properties. Support is also provided for getter/setter
    methods: if the property being accessed is a function marked by a call to
    <Function#property>, the function will be called and the result returned
    rather than just the function itself being returned. If the set function is
    called the value will be provided as the sole argument to the function; this
    will be undefined otherwise. Any changes made to public properties not using
    the set method must call the propertyDidChange method after the change to
    keep the cache consistent and possibly notify observers in overriden
    versions of this method.
*/

/**
    Function (private): O.ComputedProps-computeDependentKeys

    Finds all keys which have a dependency on the given key (note
    this is not just direct dependencies, but could be via intermediate
    properties).

    Parameters:
        cache   - {Object} An object mapping property names to the keys that are
                  directly dependent on them.
        key     - {String} The name of the property for which we are finding the
                  dependent keys.
        results - {String[]} This array will be populated with the
                  dependent keys. Non-recursive calls to this function should
                  supply an empty array here.

    Returns:
        {String[]} The results array.
*/
var computeDependentKeys = function ( cache, key, results ) {
    var dependents = cache[ key ];
    if ( dependents ) {
        var l = dependents.length;
        while ( l-- ) {
            var dependentKey = dependents[l];
            // May be multiple ways to get to this dependency.
            if ( results.indexOf( dependentKey ) === -1 ) {
                results.push( dependentKey );
                computeDependentKeys( cache, dependentKey, results );
            }
        }
    }
    return results;
};

NS.ComputedProps = {
    /**
        Method: O.ComputedProps#propertiesDependentOnKey

        Returns an array of the name of all computed properties
        which depend on the given key.

        Parameters:
            key - {String} The name of the key to fetch the dependents of.

        Returns:
            {Array} Returns the list of dependents (may be empty).
    */
    propertiesDependentOnKey: function ( key ) {
        var metadata = meta( this );
        return metadata.allDependents[ key ] ||
            ( metadata.allDependents[ key ] =
                computeDependentKeys( metadata.dependents, key, [] ) );
    },

    /**
        Method: O.ComputedProps#propertyDidChange

        Invalidates any cached values depending on the property.

        Parameters:
            key      - {String} The name of the property which has changed.
            oldValue - {*} (optional) The old value of the property.
            newValue - {*} (optional) The new value of the property.

        Returns:
            {O.ComputedProps} Returns self.
    */
    propertyDidChange: function ( key/*, oldValue, newValue*/ ) {
        var dependents = this.propertiesDependentOnKey( key ),
            l = dependents.length,
            cache = meta( this ).cache;
        while ( l-- ) {
            delete cache[ dependents[l] ];
        }
        return this;
    },

    /**
        Method: O.ComputedProps#computedPropertyDidChange

        Invalidates the cached value for a property then calls
        propertyDidChange.

        Parameters:
            key - {String} The name of the computed property which has changed.

        Returns:
            {O.ComputedProps} Returns self.
    */
    computedPropertyDidChange: function ( key ) {
        var cache = meta( this ).cache,
            oldValue = cache[ key ];
        delete cache[ key ];
        return this.propertyDidChange( key, oldValue );
    },

    /**
        Method: O.ComputedProps#clearPropertyCache

        Deletes the cache of computed property values.

        Parameters:
            key - {String} The name of the property to fetch.

        Returns:
            {O.ComputedProps} Returns self.
    */
    clearPropertyCache: function () {
        meta( this ).cache = {};
        return this;
    },

    /**
        Method: O.ComputedProps#set

        Sets the value of the named property on this object to the value given.
        If that property is actually a computed property, the new value is
        passed as an argument to that method. This will automatically call
        `propertyDidChange()` to invalidate cached values that depend on this
        property (and notify observers about the change in the case of
        <O.ObservableProps> objects).

        Parameters:
            key   - {String} The name of the property to set.
            value - {*} The new value of the property.

        Returns:
            {O.ComputedProps} Returns self.
    */
    set: function ( key, value ) {
        var oldValue = this[ key ],
            silent, cache;
        if ( oldValue && oldValue.isProperty ) {
            silent = !!oldValue.isSilent;
            value = oldValue.call( this, value, key );
            if ( !oldValue.isVolatile ) {
                cache = meta( this ).cache;
                oldValue = cache[ key ];
                cache[ key ] = value;
            } else {
                oldValue = undefined;
            }
        }
        else {
            // No point in notifying of a change if it hasn't really happened.
            silent = ( oldValue === value );
            this[ key ] = value;
        }
        return silent ? this : this.propertyDidChange( key, oldValue, value );
    },

    /**
        Method: O.ComputedProps#get

        Gets the value of the named property on this object. If there is an
        accessor function for this property it will call that rather than just
        returning the function. Values will be cached for efficient subsequent
        retrieval unless the accessor function is marked volatile.

        Parameters:
            key - {String} The name of the property to fetch.

        Returns:
            {*} The value of the property.
    */
    get: function ( key ) {
        var value = this[ key ],
            cache;
        if ( value && value.isProperty ) {
            if ( value.isVolatile ) {
                return value.call( this, undefined, key );
            }
            cache = meta( this ).cache;
            return ( key in cache ) ? cache[ key ] :
                ( cache[ key ] = value.call( this, undefined, key ) );
        }
        return value;
    },

    /**
        Method: O.ComputedProps#getFromPath

        Gets the value at the given path string relative to the object on which
        the method was called.

        Parameters:
            path - {String} The path (e.g. 'widget.view.height');

        Returns:
            {*} The value at that path relative to this object.
    */
    getFromPath: function ( path ) {
        return getFromPath( this, path );
    },

    /**
        Method: O.ComputedProps#increment

        Adds the value of the delta argument to the value stored in the property
        with the given key.

        Parameters:
            key   - {String} The name of the numerical property.
            delta - {Number} The amount to add to the current value.

        Returns:
            {O.ComputedProps} Returns self.
    */
    increment: function ( key, delta ) {
        return this.set( key, this.get( key ) + delta );
    },

    /**
        Method: O.ComputedProps#toggle

        Sets the value of the given key to the boolean negation of its previous
        value.

        Parameters:
            key - {String} The name of the property to toggle.

        Returns:
            {O.ComputedProps} Returns self.
    */
    toggle: function ( key ) {
        return this.set( key, !this.get( key ) );
    }
};

}( O ) );
