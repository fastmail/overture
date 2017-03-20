import { meta } from '../core/Core.js';  // Also Function#implement
import Binding from './Binding.js';

const setupObserver = function ( metadata, method ) {
    const observes = this.observedProperties;
    const observers = metadata.observers;
    let l = observes.length;
    let pathObservers;

    while ( l-- ) {
        const key = observes[l];
        if ( key.indexOf( '.' ) === -1 ) {
            let keyObservers = observers[ key ];
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

const teardownObserver = function ( metadata, method ) {
    const observes = this.observedProperties;
    const observers = metadata.observers;
    let l = observes.length;
    let pathObservers;

    while ( l-- ) {
        const key = observes[l];
        if ( key.indexOf( '.' ) === -1 ) {
            let keyObservers = observers[ key ];
            if ( !observers.hasOwnProperty( key ) ) {
                keyObservers = observers[ key ] = keyObservers.slice();
            }
            let j = keyObservers.length;
            while ( j-- ) {
                const observer = keyObservers[j];
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
        const properties = ( this.observedProperties ||
            ( this.observedProperties = [] ) );
        let l = arguments.length;
        while ( l-- ) {
            properties.push( arguments[l] );
        }
        this.__setupProperty__ = setupObserver;
        this.__teardownProperty__ = teardownObserver;
        return this;
    },
});

/**
    Method (private): O.ObservableProps-_setupTeardownPaths

    Adds or removes path observers for methods on an object.

    Parameters:
        obj    - {Object} The object to setup/teardown path observers for.
        method - {String} Either 'addObserverForPath' or 'removeObserverForPath'
*/
const _setupTeardownPaths = function ( obj, method ) {
    const pathObservers = meta( obj ).pathObservers;
    for ( const key in pathObservers ) {
        const paths = pathObservers[ key ];
        if ( paths ) {
            let l = paths.length;
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
const _notifyObserversOfKey =
        function ( that, metadata, key, oldValue, newValue ) {
    let observers = metadata.observers[ key ];
    let l;
    if ( observers && ( l = observers.length ) ) {
        const isInitialised = metadata.isInitialised;
        let haveCheckedForNew = false;
        // Remember, observers may be removed (or possibly added, but that's
        // less likely) during the iterations. Clone array before iterating
        // to avoid the problem.
        observers = observers.slice();
        while ( l-- ) {
            const observer = observers[l];
            const object = observer.object || that;
            const method = observer.method;
            // During initialisation, this method is only called when a
            // binding syncs. We want to give the illusion of the bound
            // properties being present on the object from the beginning, so
            // they can be used interchangably with non-bound properties, so
            // suppress notification of observers. However, if there is
            // another binding that is bound to this one, we need to notify
            // that to ensure it syncs the correct initial value.
            // We also need to set up any path observers correctly.
            let path;
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
                if ( object instanceof Binding ) {
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
const _notifyGenericObservers = function ( that, metadata, changed ) {
    const observers = metadata.observers[ '*' ];
    if ( observers ) {
        let l = observers.length;
        while ( l-- ) {
            const observer = observers[l];
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

export default {

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
        const observers = meta( this ).observers;
        for ( const key in observers ) {
            const keyObservers = observers[ key ];
            let l = keyObservers.length;
            while ( l-- ) {
                const object = keyObservers[l].object;
                if ( object && object !== this &&
                        // Ignore bindings that belong to the object.
                        !( ( object instanceof Binding ) &&
                             object.toObject === this ) ) {
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
        const metadata = meta( this );
        if ( metadata.depth === 1 ) {
            // Notify observers.
            let changed;
            while ( changed = metadata.changed ) {
                metadata.changed = null;
                for ( const key in changed ) {
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
        const metadata = meta( this );
        const isInitialised = metadata.isInitialised;
        const dependents = isInitialised ?
                this.propertiesDependentOnKey( key ) : [];
        let l = dependents.length;
        const depth = metadata.depth;
        const hasGenericObservers = metadata.observers[ '*' ];
        const fastPath = !l && !depth && !hasGenericObservers;
        const changed = fastPath ? null : metadata.changed || {};
        const cache = metadata.cache;

        if ( fastPath ) {
            _notifyObserversOfKey( this, metadata, key, oldValue, newValue );
        } else {
            while ( l-- ) {
                const prop = dependents[l];
                if ( !changed[ prop ] ) {
                    changed[ prop ] = {
                        oldValue: cache[ prop ],
                    };
                }
                delete cache[ prop ];
            }

            changed[ key ] = {
                oldValue: changed[ key ] ? changed[ key ].oldValue : oldValue,
                newValue: newValue,
            };

            if ( metadata.depth ) {
                metadata.changed = changed;
            } else {
                // Notify observers of dependent keys.
                for ( const prop in changed ) {
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
        const observers = meta( this ).observers;
        let keyObservers = observers[ key ];
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
        const observers = meta( this ).observers;
        const keyObservers = observers[ key ];
        if ( keyObservers ) {
            let l = keyObservers.length;
            while ( l-- ) {
                const observer = keyObservers[l];
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
        const nextDot = path.indexOf( '.' );
        if ( nextDot === -1 ) {
            this.addObserverForKey( path, object, method );
        }
        else {
            const key = path.slice( 0, nextDot );
            const value = this.get( key );
            const restOfPath = path.slice( nextDot + 1 );
            const observers = meta( this ).observers;
            let keyObservers = observers[ key ];
            if ( !observers.hasOwnProperty( key ) ) {
                keyObservers = observers[ key ] = keyObservers ?
                    keyObservers.slice() : [];
            }

            keyObservers.push({
                path: restOfPath,
                object: object,
                method: method,
            });
            if ( value && !( value instanceof Binding ) ) {
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
        const nextDot = path.indexOf( '.' );
        if ( nextDot === -1 ) {
            this.removeObserverForKey( path, object, method );
        }
        else {
            const key = path.slice( 0, nextDot );
            const value = this.get( key );
            const restOfPath = path.slice( nextDot + 1 );
            const observers = meta( this ).observers[ key ];

            if ( observers ) {
                let l = observers.length;
                while ( l-- ) {
                    const observer = observers[l];
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
    },
};

// TODO(cmorgan/modulify): do something about these exports: Function#observes
