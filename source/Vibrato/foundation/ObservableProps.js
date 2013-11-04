// -------------------------------------------------------------------------- \\
// File: ObservableProps.js                                                   \\
// Module: Foundation                                                         \\
// Requires: Core, RunLoop.js                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined  ) {

var meta = NS.meta;

var setupObserver = function ( metadata, method ) {
    var observes = this.observedProperties,
        observers = metadata.observers,
        l = observes.length,
        key, keyObservers, pathObservers;

    while ( l-- ) {
        key = observes[l];
        if ( key.indexOf( '.' ) === -1 ) {
            keyObservers = observers[ key ];
            if ( !observers.hasOwnProperty( key ) ) {
                keyObservers = observers[ key ] = keyObservers ?
                    keyObservers.slice() : [];
            }
            keyObservers.push({ object: null, method: method });
        } else {
            if ( !pathObservers ) {
                pathObservers = metadata.pathObservers;
                if ( !metadata.hasOwnProperty( 'pathObservers' ) ) {
                    pathObservers =
                        metadata.pathObservers = Object.create( pathObservers );
                }
                // There can't be any existing path observers for this method,
                // as we're only just adding it (and if we're overriding a
                // previous method, we should have removed all of their path
                // observers first anyway).
                pathObservers = pathObservers[ method ] = [];
                metadata.inits.Observers =
                    ( metadata.inits.Observers || 0 ) + 1;
            }
            pathObservers.push( key );
        }
    }
};

var teardownObserver = function ( metadata, method ) {
    var observes = this.observedProperties,
        observers = metadata.observers,
        l = observes.length,
        key, keyObservers, observer, j, pathObservers;

    while ( l-- ) {
        key = observes[l];
        if ( key.indexOf( '.' ) === -1 ) {
            keyObservers = observers[ key ];
            if ( !observers.hasOwnProperty( key ) ) {
                keyObservers = observers[ key ] = keyObservers.slice();
            }
            j = keyObservers.length;
            while ( j-- ) {
                observer = keyObservers[j];
                if ( observer.object === null &&
                        observer.method === method ) {
                    keyObservers.splice( j, 1 );
                    break;
                }
            }
        } else {
            if ( !pathObservers ) {
                pathObservers = metadata.pathObservers;
                if ( !metadata.hasOwnProperty( 'pathObservers' ) ) {
                    pathObservers =
                        metadata.pathObservers = Object.create( pathObservers );
                }
                // We want to remove all path observers. Can't just delete
                // though, as it may defined on the prototype object.
                pathObservers[ method ] = null;
                metadata.inits.Observers -= 1;
            }
        }
    }
};

Function.implement({
    /**
        Method: Function#observes

        Defines the list of properties (on the same object) or paths (relative
        to this object) that this method is interested in. Whenever one of these
        properties changes, the method will automatically be called.

        Parameters:
            var_args - {...String} All arguments are treated as the names of
                       properties this method should observe.

        Returns:
            {Function} Returns self.
     */
    observes: function () {
        var properties = ( this.observedProperties ||
            ( this.observedProperties = [] ) ),
            l = arguments.length;
        while ( l-- ) {
            properties.push( arguments[l] );
        }
        this.__setupProperty__ = setupObserver;
        this.__teardownProperty__ = teardownObserver;
        return this;
    }
});

/**
    Method (private): O.ObservableProps-_setupTeardownPaths

    Adds or removes path observers for methods on an object.

    Parameters:
        obj    - {Object} The object to setup/teardown path observers for.
        method - {String} Either 'addObserverForPath' or 'removeObserverForPath'
*/
var _setupTeardownPaths = function ( obj, method ) {
    var pathObservers = meta( obj ).pathObservers,
        key, paths, l;
    for ( key in pathObservers ) {
        paths = pathObservers[ key ];
        if ( paths ) {
            l = paths.length;
            while ( l-- ) {
                obj[ method ]( paths[l], obj, key );
            }
        }
    }
};

/**
    Method (private): O.ObservableProps-_notifyObserversOfKey

    Notifies any observers of a particular key and also removes old path
    observers and adds them to the new object.

    Parameters:
        that     - {O.ObservableProps} The object on which the property has
                   changed.
        metadata - {Object} The metadata for this object.
        key      - {String} The name of the property whose observers need to
                   be notified.
        oldValue - {*} The old value for the property.
        newValue - {*} The new value for the property.
*/
var _notifyObserversOfKey =
        function ( that, metadata, key, oldValue, newValue ) {
    var observers = metadata.observers[ key ],
        isInitialised = metadata.isInitialised,
        haveCheckedForNew = false,
        observer, object, method, path, l;
    if ( observers && ( l = observers.length ) ) {
        // Remember, observers may be removed (or possibly added, but that's
        // less likely) during the iterations. Clone array before iterating
        // to avoid the problem.
        observers = observers.slice();
        while ( l-- ) {
            observer = observers[l];
            object = observer.object || that;
            method = observer.method;
            // During initialisation, this method is only called when a
            // binding syncs. We want to give the illusion of the bound
            // properties being present on the object from the beginning, so
            // they can be used interchangably with non-bound properties, so
            // suppress notification of observers. However, if there is
            // another binding that is bound to this one, we need to notify
            // that to ensure it syncs the correct initial value.
            // We also need to set up any path observers correctly.
            if ( isInitialised ) {
                if ( path = observer.path ) {
                    // If it's a computed property we don't really want to call
                    // it unless it's needed; could be expensive.
                    if ( newValue === undefined && !haveCheckedForNew ) {
                        newValue = /^\d+$/.test( key ) ?
                            that.getObjectAt( parseInt( key, 10 ) ) :
                            that.get( key );
                        haveCheckedForNew = true;
                    }
                    // Either value could be null
                    if ( oldValue ) {
                        oldValue.removeObserverForPath( path, object, method );
                    }
                    if ( newValue ) {
                        newValue.addObserverForPath( path, object, method );
                    }
                    object[ method ]( that, key,
                        oldValue && oldValue.getFromPath( path ),
                        newValue && newValue.getFromPath( path ) );
                } else {
                    object[ method ]( that, key, oldValue, newValue );
                }
            } else {
                // Setup path observers on initial value.
                if ( newValue && ( path = observer.path ) ) {
                    newValue.addObserverForPath( path, object, method );
                }
                // Sync binding immediately
                if ( object instanceof NS.Binding ) {
                    object[ method ]();
                    object.sync();
                }
            }
        }
    }
};

/**
    Method (private): O.ObservableProps-_notifyGenericObservers

    Notifies any observers interested (registered as observing key '*') that
    at least one property has changed on this object.

    Parameters:
        that     - {O.ObservableProps} The object on which the property has
                   changed.
        metadata - {Object} The metadata for this object.
        changed  - {Object} A map of property names to another object. This
                   object has an oldValue and possibly a newValue property.
*/
var _notifyGenericObservers = function ( that, metadata, changed ) {
    var observers = metadata.observers[ '*' ],
        observer, l;
    if ( observers ) {
        l = observers.length;
        while ( l-- ) {
            observer = observers[l];
            ( observer.object || that )[ observer.method ]( that, changed );
        }
    }
};

/**
    Mixin: O.ObservableProps

    The O.ObservableProps mixin adds support for key-value observing to another
    class. Public properties should only be accessed and modified via the
    get/set methods inherited from <O.ComputedProps>.
*/

NS.ObservableProps = {

    /**
        Method: O.Observable#initObservers

        Initialises any observed paths on the object (observed keys do not
        require initialisation. You should never call this directly, but rather
        iterate through the keys of `O.meta( this ).inits`, calling
        `this[ 'init' + key ]()` for all keys which map to truthy values.
    */
    initObservers: function () {
        _setupTeardownPaths( this, 'addObserverForPath' );
    },

    /**
        Method: O.Observable#destroyObservers

        Removes any observed paths from the object (observed keys do not require
        destruction. You should never call this directly, but rather iterate
        through the keys of `O.meta( this ).inits`, calling
        `this[ 'destroy' + key ]()` for all keys which map to a truthy value.
    */
    destroyObservers: function () {
        _setupTeardownPaths( this, 'removeObserverForPath' );
    },

    /**
        Method: O.ObservableProps#hasObservers

        Returns true if any property on the object is currently being observed
        by another object.

        Returns:
            {Boolean} Does the object have any observers?
    */
    hasObservers: function () {
        var observers = meta( this ).observers,
            key, keyObservers, l, object;
        for ( key in observers ) {
            keyObservers = observers[ key ];
            l = keyObservers.length;
            while ( l-- ) {
                object = keyObservers[l].object;
                if ( object && object !== this ) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
        Method: O.ObservableProps#beginPropertyChanges

        Call this before changing a set of properties (and then call
        <endPropertyChanges> afterwards) to ensure that if a dependent property
        changes more than once, observers of that property will only be notified
        once of the change. No observer will be called until
        the matching <endPropertyChanges> call is made.

        Returns:
            {O.ObservableProps} Returns self.
    */
    beginPropertyChanges: function () {
        meta( this ).depth += 1;
        return this;
    },

    /**
        Method: O.ObservableProps#endPropertyChanges

        Call this after changing a set of properties (having called
        <beginPropertyChanges> before) to ensure that if a dependent property
        changes more than once, observers of that property will only be notified
        once of the change.

        Returns:
            {O.ObservableProps} Returns self.
    */
    endPropertyChanges: function () {
        var metadata = meta( this ),
            changed, key;
        if ( metadata.depth === 1 ) {
            // Notify observers.
            while ( changed = metadata.changed ) {
                metadata.changed = null;
                for ( key in changed ) {
                    _notifyObserversOfKey( this, metadata,
                        key, changed[ key ].oldValue, changed[ key ].newValue );
                }
                // Notify observers interested in any property change
                if ( metadata.observers[ '*' ] ) {
                    _notifyGenericObservers( this, metadata, changed );
                }
            }
        }
        // Only decrement here so that any further property changes that happen
        // whilst we are notifying of the previous ones are queued up and then
        // distributed in the next loop.
        metadata.depth -= 1;
        return this;
    },

    /**
        Method: O.ObservableProps#propertyDidChange

        Overrides the method in <O.ComputedProps>. Invalidates any cached
        values depending on the property and notifies any observers about the
        change. Will also notify any observers of dependent values about the
        change.

        Parameters:
            key      - {String} The name of the property which has changed.
            oldValue - {*} The old value for the property.
            newValue - {*} (optional) The new value for the property. Only there
                       if it's not a computed property.

        Returns:
            {O.ObservableProps} Returns self.
    */
    propertyDidChange: function ( key, oldValue, newValue ) {
        var metadata = meta( this ),
            isInitialised = metadata.isInitialised,
            dependents = isInitialised ?
                this.propertiesDependentOnKey( key ) : [],
            l = dependents.length,
            depth = metadata.depth,
            hasGenericObservers = metadata.observers[ '*' ],
            fastPath = !l && !depth && !hasGenericObservers,
            changed = fastPath ? null : metadata.changed || {},
            cache = metadata.cache,
            prop;

        if ( fastPath ) {
            _notifyObserversOfKey( this, metadata, key, oldValue, newValue );
        } else {
            while ( l-- ) {
                prop = dependents[l];
                if ( !changed[ prop ] ) {
                    changed[ prop ] = {
                        oldValue: cache[ prop ]
                    };
                }
                delete cache[ prop ];
            }

            changed[ key ] = {
                oldValue: changed[ key ] ? changed[ key ].oldValue : oldValue,
                newValue: newValue
            };

            if ( metadata.depth ) {
                metadata.changed = changed;
            } else {
                // Notify observers of dependent keys.
                for ( prop in changed ) {
                    _notifyObserversOfKey( this, metadata, prop,
                        changed[ prop ].oldValue, changed[ prop ].newValue );
                }

                // Notify observers interested in any property change
                if ( isInitialised && hasGenericObservers ) {
                    _notifyGenericObservers( this, metadata, changed );
                }
            }
        }

        return this;
    },

    /**
        Method: O.ObservableProps#addObserverForKey

        Registers an object and a method to be called on that object whenever a
        particular key changes in value. The method will be called with the
        following parameters: obj, key, oldValue, newValue. If it is a computed
        property the oldValue and newValue arguments may not be present. You can
        also observe '*' to be notified of any changes to the object; in this
        case the observer will only be supplied with the first argument: this
        object.

        Parameters:
            key    - {String} The property to observer.
            object - {Object} The object on which to call the callback method.
            method - {String} The name of the callback method.

        Returns:
            {O.ObservableProps} Returns self.
    */
    addObserverForKey: function ( key, object, method ) {
        var observers = meta( this ).observers,
            keyObservers = observers[ key ];
        if ( !observers.hasOwnProperty( key ) ) {
            keyObservers = observers[ key ] = keyObservers ?
                keyObservers.slice() : [];
        }
        keyObservers.push({ object: object, method: method });
        return this;
    },

    /**
        Method: O.ObservableProps#removeObserverForKey

        Removes an object/method pair from the list of those to be called when
        the property changes. Must use identical arguments to a previous call to
        <addObserverForKey>.

        Parameters:
            key    - {String} The property which is being observed.
            object - {Object} The object which is observing it.
            method - {String} The name of the callback method on the observer
                     object.

        Returns:
            {O.ObservableProps} Returns self.
    */
    removeObserverForKey: function ( key, object, method ) {
        var observers = meta( this ).observers,
            keyObservers = observers[ key ],
            observer, l;
        if ( keyObservers ) {
            l = keyObservers.length;
            while ( l-- ) {
                observer = keyObservers[l];
                if ( observer.object === object &&
                        observer.method === method ) {
                    keyObservers.splice( l, 1 );
                    break;
                }
            }
            if ( !keyObservers.length ) {
                delete observers[ key ];
            }
        }
        return this;
    },

    /**
        Method: O.ObservableProps#addObserverForPath

        Registers an object and a method to be called on that object whenever
        any property in a given path string changes. Note, this path is live, in
        that if you observe `foo.bar.x` and `bar` changes, you will receive a
        callback, and the observer will be deregistered from the old `bar`, and
        registered on the new one.

        Parameters:
            path   - {String} The path to observe.
            object - {Object} The object on which to call the callback method.
            method - {String} The name of the callback method.

        Returns:
            {O.ObservableProps} Returns self.
    */
    addObserverForPath: function ( path, object, method ) {
        var nextDot = path.indexOf( '.' );
        if ( nextDot === -1 ) {
            this.addObserverForKey( path, object, method );
        }
        else {
            var key = path.slice( 0, nextDot ),
                value = this.get( key ),
                restOfPath = path.slice( nextDot + 1 ),
                observers = meta( this ).observers,
                keyObservers = observers[ key ];
            if ( !observers.hasOwnProperty( key ) ) {
                keyObservers = observers[ key ] = keyObservers ?
                    keyObservers.slice() : [];
            }

            keyObservers.push({
                path: restOfPath,
                object: object,
                method: method
            });
            if ( value && !( value instanceof NS.Binding ) ) {
                value.addObserverForPath( restOfPath, object, method );
            }
        }
        return this;
    },

    /**
        Method: O.ObservableProps#removeObserverForPath

        Removes an observer for a path added with <addObserverForPath>.

        Parameters:
            path   - {String} The path which is being observed.
            object - {Object} The object which is observing it.
            method - {String} The name of the callback method on the observer
                     object.

        Returns:
            {O.ObservableProps} Returns self.
    */
    removeObserverForPath: function ( path, object, method ) {
        var nextDot = path.indexOf( '.' );
        if ( nextDot === -1 ) {
            this.removeObserverForKey( path, object, method );
        }
        else {
            var key = path.slice( 0, nextDot ),
                value = this.get( key ),
                restOfPath = path.slice( nextDot + 1 ),
                observers = meta( this ).observers[ key ],
                observer, l;

            if ( observers ) {
                l = observers.length;
                while ( l-- ) {
                    observer = observers[l];
                    if ( observer.path === restOfPath &&
                         observer.object === object &&
                         observer.method === method) {
                            observers.splice( l, 1 );
                            break;
                    }
                }
            }
            if ( value ) {
                value.removeObserverForPath( restOfPath, object, method );
            }
        }
        return this;
    }
};

}( this.O ) );
