// -------------------------------------------------------------------------- \\
// File: Binding.js                                                           \\
// Module: Foundation                                                         \\
// Requires: Core, ComputedProps.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

/**
    Class: O.Binding

    Includes: O.ComputedProps

    Bindings keep a property on one object in sync with a property on another.
    This may be a two way link, so a change on either updates the other, or it
    may only flow data in one direction. A transform may be applied to the data
    between instances.

    To use, create a new instance then call <O.Binding#from>, <O.Binding#to> and
    <O.Binding#connect>. Connection will normally be handled by the
    <O.BoundProps> class rather than directly.
*/

/**
    Method (private): O.Binding-_resolveRootAndPath

    When created, a binding may need to reference a path on an object that does
    not yet exist (it will be created later in the run loop). To allow this, a
    section of the path may be defined as 'static', that is to say it is
    resolved only once; at initialisation time. Any changes along this path;
    only changes starting from the final static object will be observed.

    A static portion is signified by using a `*` as a divider instead of a `.`.
    The section before the '*' is taken to be static. If no '*' is present, the
    entire path is taken to be dynamic. For example, if the path is
    `Application.static.path*dynamic.path`, at initialisation time, the `static`
    property of the `Application` property of the root object (or global object
    if none) will be found. After initialisation, any changes to the 'dynamic'
    property on this object, or the 'path' property on that object will trigger
    the binding.

    The results are set directly on the binding object passed as the first
    argument, with names direction + 'Object'/'Path'.

    Parameters:
        binding   - {O.Binding} The binding to resolve paths for.
        direction - {String} Either 'to' or 'from'.
        path      - {String} The path string.
        root      - {Object} The object to treat as root.
*/
var _resolveRootAndPath = function ( binding, direction, path, root ) {
    var beginObservablePath = path.lastIndexOf( '*' ) + 1,
        observablePath = path.slice( beginObservablePath ),
        staticPath = beginObservablePath ?
            path.slice( 0, beginObservablePath - 1 ) : '';

    binding.set( direction + 'Object',
        staticPath ? NS.getFromPath( staticPath, root ) : root );
    binding.set( direction + 'Path', observablePath );
};

/**
    Method (private): O.Binding-identity

    Returns the first argument. This is the default transform (has no effect).

    Parameters:
        v - {*} The value.

    Returns:
        {*} The value v.
*/
var identity = function ( v ) { return v; };

var Binding = NS.Class({

    Mixin: NS.ComputedProps,

    __setupProperty__: function ( metadata, key ) {
        metadata.bindings[ key ] = this;
        metadata.inits.Bindings = ( metadata.inits.Bindings || 0 ) + 1;
    },
    __teardownProperty__: function ( metadata, key ) {
        metadata.bindings[ key ] = null;
        metadata.inits.Bindings -= 1;
    },

    /**
        Property (private): O.Binding#_isConnected
        Type: Boolean

        Is the instance currently observing for changes?
    */
    _isConnected: false,

    /**
        Property (private): O.Binding#_needsSync
        Type: Boolean

        Has the data changed on the from object (or the 'to' object if two-way)?
    */
    _needsSync: true,

    /**
        Property (private): O.Binding#_isSuspended
        Type: Boolean

        Should the binding stop propagating changes?
    */
    _isSuspended: false,

    /**
        Property (private): O.Binding#_syncFromToTo
        Type: Boolean

        The direction to sync from. True if syncing from the 'from' object to
        the 'to' object, false if it's going to do the reverse.
    */
    _syncFromToTo: true,

    /**
        Property: O.Binding#isTwoWay
        Type: Boolean

        Are changes just propagated from the 'from' object to the 'to' object,
        or are they also sent the other way?
    */
    isTwoWay: false,

    /**
        Constructor: O.Binding

        Parameters:
            config - {Object} (optional). Can set isTwoWay or the transform to
                     use on the binding.
    */
    init: function ( config ) {
        for ( var key in config ) {
            if ( this[ key ] instanceof Function && !this[ key ].isProperty ) {
                this[ key ]( config[ key ] );
            } else {
                this.set( key, config[ key ] );
            }
        }
    },

    /**
        Method: O.Binding#destroy

        Disconnects binding and prevents any further value syncs.
    */
    destroy: function () {
        this.disconnect();
        // Ignore any remaining queued sync() or connect() calls.
        this._isSuspended = this._isConnected = true;
    },

    /**
        Method: O.Binding#from

        Sets the path and object to observe for changes. This method has no
        effect if it is called after the object is connected.

        Parameters:
            path - {String} Any path before a *' is resolved at connection time
                   and then remains static. Path components after this are
                   treated as a dynamic path to watch for changes. If there is
                   no '*' present in the string, the entire string is taken as a
                   dynamic path.
            root - {Object} (optional) The object the static path is resolved
                   against, will be the global object if not supplied.

        Returns:
            {O.Binding} Returns self.
    */
    from: function ( path, root ) {
        this._fromPath = path;
        this._fromRoot = root;
        return this;
    },

    /**
        Method: O.Binding#to

        Sets the path and object to propagate changes to. This method has no
        effect if it is called after the object is connected.

        Parameters:
            path - {String} Any path before a *' is resolved at connection time
                   and then remains static. Path components after this are
                   treated as a dynamic path to watch for changes. If there is
                   no '*' present in the string, the entire string is taken as a
                   dynamic path.
            root - {Object} (optional) The object the static path is resolved
                   against, will be the global object if not supplied.

        Returns:
            {O.Binding} Returns self.
    */
    to: function ( path, root ) {
        this._toPath = path;
        this._toRoot = root;
        return this;
    },

    // ------------

    /**
        Property: O.Binding#fromObject
        Type: Object

        The static object the observed path begins from.
    */

    /**
        Property: O.Binding#fromPath
        Type: String

        The dynamic path to observe on the from object.
    */

    /**
        Property: O.Binding#fromKey
        Type: String

        The final component of the fromPath (the property name on the final
        object).
    */
    fromKey: function () {
        var fromPath = this.get( 'fromPath' );
        return fromPath.slice( fromPath.lastIndexOf( '.' ) + 1 );
    }.property( 'fromPath' ),

    /**
        Property: O.Binding#fromPathBeforeKey
        Type: String

        The dynamic 'from' path component before the final key.
    */
    fromPathBeforeKey: function () {
        var fromPath = this.get( 'fromPath' ),
            lastDot = fromPath.lastIndexOf( '.' );
        return ( lastDot === -1 ) ? null : fromPath.slice( 0, lastDot );
    }.property( 'fromPath' ),

    /**
        Property: O.Binding#toObject
        Type: Object

        The static object from which the object-to-update path is resolved.
    */

    /**
        Property: O.Binding#toPath
        Type: String

        The dynamic path to follow on the to object.
    */

    /**
        Property: O.Binding#toKey
        Type: String

        The final component of the toPath (the property name on the final
        object).
    */
    toKey: function () {
        var toPath = this.get( 'toPath' );
        return toPath.slice( toPath.lastIndexOf( '.' ) + 1 );
    }.property( 'toPath' ),

    /**
        Property: O.Binding#toPathBeforeKey
        Type: String

        The dynamic 'to' path component before the final key.
    */
    toPathBeforeKey: function () {
        var toPath = this.get( 'toPath' ),
            lastDot = toPath.lastIndexOf( '.' );
        return ( lastDot === -1 ) ? null : toPath.slice( 0, lastDot );
    }.property( 'toPath' ),

    // ------------

    /**
        Property (private): O.Binding#_doNotDelayConnection
        Type: Boolean

        If the to or from object cannot be resolved, should the binding delay
        the connection until the end of the run loop?
    */
    _doNotDelayConnection: false,

    /**
        Method: O.Binding#connect

        Starts observing for changes and syncs the current value of the observed
        property on the from object with the bound property on the to object.

        Returns:
            {O.Binding} Returns self.
    */
    connect: function () {
        if ( this._isConnected ) { return this; }

        // Resolve objects:
        _resolveRootAndPath(
            this, 'from', this._fromPath, this._fromRoot || this._toRoot );
        _resolveRootAndPath(
            this, 'to', this._toPath, this._toRoot || this._fromRoot );

        var fromObject = this.get( 'fromObject' ),
            toObject = this.get( 'toObject' );

        // Occassionally we have a binding created before the objects it
        // connects are, in which case wait until the end of the runloop to
        // connect it.
        if ( !this._doNotDelayConnection && ( !fromObject || !toObject ) ) {
            this._doNotDelayConnection = true;
            NS.RunLoop.queueFn( 'before', this.connect, this );
            return this;
        }

        fromObject.addObserverForPath(
            this.get( 'fromPath' ), this, '_fromDidChange' );

        // Grab initial value:
        this.sync();

        if ( this.get( 'isTwoWay' ) ) {
            toObject.addObserverForPath(
                this.get( 'toPath' ), this, '_toDidChange' );
        }
        this._isConnected = true;
        return this;
    },

    /**
        Method: O.Binding#disconnect

        Stops observing for changes.

        Returns:
            {O.Binding} Returns self.
    */
    disconnect: function () {
        if ( !this._isConnected ) { return this; }

        this.get( 'fromObject' ).removeObserverForPath(
            this.get( 'fromPath' ), this, '_fromDidChange' );

        if ( this.get( 'isTwoWay' ) ) {
            this.get( 'toObject' ).removeObserverForPath(
                this.get( 'toPath' ), this, '_toDidChange' );
        }

        this._isConnected = false;
        this._needsSync = true;
        this._syncFromToTo = true;

        return this;
    },

    /**
        Method: O.Binding#suspend

        Stop propagating changes. The instance will still note when the observed
        object changes, but will not sync this to the bound property on the to
        object until the <O.Binding#resume> method is called.

        Returns:
            {O.Binding} Returns self.
    */
    suspend: function () {
        this._isSuspended = true;
        return this;
    },

    /**
        Method: O.Binding#resume

        Restart propagating changes. Sync the to object if the observed property
        has changed.

        Returns:
            {O.Binding} Returns self.
    */
    resume: function () {
        if ( this._isSuspended ) {
            this._isSuspended = false;
            this.sync();
        }
        return this;
    },

    // ------------

    /**
        Property (private): O.Binding#_transform
        Type: Function

        The transform to apply to values.
    */
    _transform: identity,

    /**
        Method: O.Binding#resetTransforms

        Clears any transforms set on the object

        Returns:
            {O.Binding} Returns self.
    */
    resetTransforms: function () {
        this._transform = identity;
        return this;
    },

    /**
        Property: O.Binding#transform
        Type: Function

        A function which is applied to a value coming from one object before it
        is set on the other object. If this value is set multiple times without
        calling the resetTransforms method, the functions will be chained and
        applied in the order in which they were added.
    */
    transform: function ( fn ) {
        if ( fn ) {
            var old = this._transform;
            this._transform = ( old === identity ? fn : function ( v, dir ) {
                return fn( old( v, dir ), dir );
            });
        }
        return this._transform;
    }.property(),

    /**
        Method: O.Binding#defaultValue

        Helper method to set a transform which converts any falsy value to the
        value supplied as the only parameter to this method.

        Parameters:
            value - {*} The default value to use.
    */
    defaultValue: function ( value ) {
        return this.set( 'transform', function ( v ) {
            return v !== undefined ? v : value;
        });
    },

    // ------------

    /**
        Method (private): O.Binding#_fromDidChange

        Called when the observed property on the from object changes; adds the
        binding to the queue to be synced at the end of the run loop.

        Returns:
            {O.Binding} Returns self.
    */
    _fromDidChange: function () {
        this._needsSync = true;
        this._syncFromToTo = true;
        if ( !this._isSuspended ) {
            NS.RunLoop.queueFn( 'bindings', this.sync, this );
        }
        return this;
    },

    /**
        Method (private): O.Binding#_toDidChange

        If the binding is two-way, this is called when the observed property on
        the to object changes; adds the binding to the queue to be synced at the
        end of the run loop.

        Returns:
            {O.Binding} Returns self.
    */
    _toDidChange: function () {
        this._needsSync = true;
        this._syncFromToTo = false;
        if ( !this._isSuspended ) {
            NS.RunLoop.queueFn( 'bindings', this.sync, this );
        }
        return this;
    },

    /**
        Method: O.Binding#sync

        If the observed property has changed, this method applies any transforms
        and propagates the data to the other object.

        Parameters:
            force - {Boolean} If true, sync the binding even if it hasn't
                    changed.

        Returns:
            {Boolean} Did the binding actually make a change?
    */
    sync: function ( force ) {
        if ( !force && ( !this._needsSync || this._isSuspended ) ) {
            return false;
        }

        this._needsSync = false;

        var syncForward = this._syncFromToTo,
            from = syncForward ? 'from' : 'to',
            to = syncForward ? 'to' : 'from',
            path = this.get( to + 'PathBeforeKey' ),
            toObj = this.get( to + 'Object' ),
            key, value;

        if ( path ) { toObj = toObj.getFromPath( path ); }
        if ( !toObj ) { return false; }

        key = this.get( to + 'Key' );
        value = this.get( 'transform' ).call( this,
            this.get( from + 'Object' )
                .getFromPath( this.get( from + 'Path' ) ),
            syncForward
        );
        if ( value !== undefined ) {
            toObj.set( key, value );
        }
        return true;
    }
});

NS.Binding = Binding;

/**
    Function: O.bind

    Convenience method. A shortcut for:
        new Binding({
            transform: transform
        }).from( path, root );

    Parameters:
        path      - {String} The path to bind from
        root      - {Object} (optional) The root object on the path to bind
                    from. If not specified, will be the object the property is
                    bound to.
        transform - {Function} (optional) A transform to apply.

    Returns:
        {O.Binding} The new binding.
*/
NS.bind = function ( path, root, transform ) {
    return new Binding({
        transform: transform
    }).from( path, root );
};

}( this.O ) );
