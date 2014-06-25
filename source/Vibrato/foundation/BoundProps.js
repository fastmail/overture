// -------------------------------------------------------------------------- \\
// File: BoundProps.js                                                        \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var meta = NS.meta;
var bindingKey = '__binding__';

/**
    Mixin: O.BoundProps

    The BoundProps mixin provides support for initialising bound properties
    inherited from the prototype, and for suspending/resuming bindings on the
    object.
*/
NS.BoundProps = {
    /**
        Method: O.BoundProps#initBindings

        Initialises bound properties. Creates a new Binding object if the
        binding is inherited, then connects it to the appropriate key and does
        an initial sync. You should never call this directly, but rather iterate
        through the keys of `O.meta( this ).inits`, calling
        `this[ 'init' + key ]()` for all keys which map to a truthy value.

        Returns:
            {O.BoundProps} Returns self.
    */
    initBindings: function () {
        var bindings = meta( this ).bindings,
            key, binding;
        for ( key in bindings ) {
            // Guard in case a previously bound property has been overridden in
            // a subclass by a non-bound value.
            if ( binding = bindings[ key ] ) {
                if ( !bindings.hasOwnProperty( key ) ) {
                    binding = bindings[ key ] = Object.create( binding );
                }
                // Set it to undefined. If the initial value to be synced
                // is undefined, nothing will be synced, but we don't want to
                // leave the Binding object itself as the value; instead we want
                // the value to be undefined.
                this[ key ] = undefined;
                binding.to( key, this ).connect();
            }
        }
        return this;
    },

    /**
        Method: O.BoundProps#destroyBindings

        Disconnect and destroy all bindings connected to this object. You should
        never call this directly, but rather iterate through the keys of
        `O.meta( this ).inits`, calling `this[ 'destroy' + key ]()` for all keys
        which map to a truthy value.

        Returns:
            {O.BoundProps} Returns self.
    */
    destroyBindings: function () {
        var bindings = meta( this ).bindings,
            key, binding;
        for ( key in bindings ) {
            // Guard in case a previously bound property has been overridden in
            // a subclass by a non-bound value.
            if ( binding = bindings[ key ] ) {
                binding.destroy();
            }
        }
        return this;
    },

    /**
        Method: O.BoundProps#registerBinding

        Call this whenever you add a binding to an object after initialisation,
        otherwise suspend/remove/destroy will not work correctly.

        Returns:
            {O.BoundProps} Returns self.
    */
    registerBinding: function ( binding ) {
        meta( this ).bindings[ bindingKey + NS.guid( binding ) ] = binding;
        return this;
    },

    /**
        Method: O.BoundProps#deregisterBinding

        Call this if you destroy a binding to this object before the object
        itself is destroyed.

        Returns:
            {O.BoundProps} Returns self.
    */
    deregisterBinding: function ( binding ) {
        var bindings = meta( this ).bindings,
            key = Object.keyOf( bindings, binding );
        delete bindings[ key ];
        return this;
    },

    /**
        Method: O.BoundProps#suspendBindings

        Suspend all bindings to the object.

        Returns:
            {O.BoundProps} Returns self.
    */
    suspendBindings: function () {
        var bindings = meta( this ).bindings,
            key, binding;
        for ( key in bindings ) {
            if ( binding = bindings[ key ] ) {
                binding.suspend();
            }
        }
        return this;
    },

    /**
        Method: O.BoundProps#resumeBindings

        Resume (and sync if necessary) all bindings to the object.

        Returns:
            {O.BoundProps} Returns self.
    */
    resumeBindings:  function () {
        var bindings = meta( this ).bindings,
            key, binding;
        for ( key in bindings ) {
            if ( binding = bindings[ key ] ) {
                binding.resume();
            }
        }
        return this;
    }
};

}( this.O ) );
