import { meta, clone } from '../core/Core';
import '../core/Array';  // For Array#erase

import getFromPath from './getFromPath';

/**
    Module: Foundation

    The Foundation module provides the basic objects and mixins for key-value
    coding and observation as well as bindings and a run loop.
*/

const slice = Array.prototype.slice;

const makeComputedDidChange = function ( key ) {
    return function () {
        this.computedPropertyDidChange( key );
    };
};

const setupComputed = function ( metadata, key, obj ) {
    const dependencies = this.dependencies;
    let dependents = metadata.dependents;
    let method, pathObservers, methodObservers;

    if ( !metadata.hasOwnProperty( 'dependents' ) ) {
        dependents = metadata.dependents = clone( dependents );
        metadata.allDependents = {};
    }
    let l = dependencies.length;
    while ( l-- ) {
        const valueThisKeyDependsOn = dependencies[l];
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

const teardownComputed = function ( metadata, key ) {
    const dependencies = this.dependencies;
    let dependents = metadata.dependents;
    let method, pathObservers, methodObservers;

    if ( !metadata.hasOwnProperty( 'dependents' ) ) {
        dependents = metadata.dependents = clone( dependents );
        metadata.allDependents = {};
    }
    let l = dependencies.length;
    while ( l-- ) {
        const valueThisKeyDependsOn = dependencies[l];
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

Object.assign( Function.prototype, {
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
    property () {
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
    nocache () {
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
    doNotNotify () {
        this.isSilent = true;
        return this;
    },
});

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
const computeDependentKeys = function ( cache, key, results ) {
    const dependents = cache[ key ];
    if ( dependents ) {
        let l = dependents.length;
        while ( l-- ) {
            const dependentKey = dependents[l];
            // May be multiple ways to get to this dependency.
            if ( results.indexOf( dependentKey ) === -1 ) {
                results.push( dependentKey );
                computeDependentKeys( cache, dependentKey, results );
            }
        }
    }
    return results;
};

export default {
    /**
        Method: O.ComputedProps#propertiesDependentOnKey

        Returns an array of the name of all computed properties
        which depend on the given key.

        Parameters:
            key - {String} The name of the key to fetch the dependents of.

        Returns:
            {Array} Returns the list of dependents (may be empty).
    */
    propertiesDependentOnKey ( key ) {
        const metadata = meta( this );
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
    propertyDidChange ( key/*, oldValue, newValue*/ ) {
        const dependents = this.propertiesDependentOnKey( key );
        let l = dependents.length;
        const cache = meta( this ).cache;
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
            newValue - {*} (optional) The new value for the property

        Returns:
            {O.ComputedProps} Returns self.
    */
    computedPropertyDidChange ( key, newValue ) {
        const cache = meta( this ).cache;
        const oldValue = cache[ key ];
        delete cache[ key ];
        if ( newValue !== undefined ) {
            cache[ key ] = newValue;
        }
        return this.propertyDidChange( key, oldValue, newValue );
    },

    /**
        Method: O.ComputedProps#clearPropertyCache

        Deletes the cache of computed property values.

        Parameters:
            key - {String} The name of the property to fetch.

        Returns:
            {O.ComputedProps} Returns self.
    */
    clearPropertyCache () {
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
    set ( key, value ) {
        let oldValue = this[ key ],
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
    get ( key ) {
        const value = this[ key ];
        if ( value && value.isProperty ) {
            if ( value.isVolatile ) {
                return value.call( this, undefined, key );
            }
            const cache = meta( this ).cache;
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
    getFromPath ( path ) {
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
    increment ( key, delta ) {
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
    toggle ( key ) {
        return this.set( key, !this.get( key ) );
    },
};

// TODO(cmorgan/modulify): do something about these exports: Function#property,
// Function#nocache, Function#doNotNotify
