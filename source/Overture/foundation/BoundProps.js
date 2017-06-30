import { meta, guid } from '../core/Core.js';

const bindingKey = '__binding__';

/**
    Mixin: O.BoundProps

    The BoundProps mixin provides support for initialising bound properties
    inherited from the prototype, and for suspending/resuming bindings on the
    object.
*/
export default {
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
    initBindings () {
        const bindings = meta( this ).bindings;
        for ( const key in bindings ) {
            // Guard in case a previously bound property has been overridden in
            // a subclass by a non-bound value.
            let binding;
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
    destroyBindings () {
        const bindings = meta( this ).bindings;
        for ( const key in bindings ) {
            // Guard in case a previously bound property has been overridden in
            // a subclass by a non-bound value.
            const binding = bindings[ key ];
            if ( binding ) {
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
    registerBinding ( binding ) {
        const metadata = meta( this );
        metadata.bindings[ bindingKey + guid( binding ) ] = binding;
        metadata.inits.Bindings = ( metadata.inits.Bindings || 0 ) + 1;
        return this;
    },

    /**
        Method: O.BoundProps#deregisterBinding

        Call this if you destroy a binding to this object before the object
        itself is destroyed.

        Returns:
            {O.BoundProps} Returns self.
    */
    deregisterBinding ( binding ) {
        const metadata = meta( this );
        const bindings = metadata.bindings;
        const key = Object.keyOf( bindings, binding );
        if ( key ) {
            bindings[ key ] = null;
            metadata.inits.Bindings -= 1;
        }
        return this;
    },

    /**
        Method: O.BoundProps#suspendBindings

        Suspend all bindings to the object. This means that any bindings to the
        object will still note if there is a change, but will not sync that
        change until the binding is resumed.

        Returns:
            {O.BoundProps} Returns self.
    */
    suspendBindings () {
        const bindings = meta( this ).bindings;
        for ( const key in bindings ) {
            const binding = bindings[ key ];
            if ( binding ) {
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
    resumeBindings () {
        const bindings = meta( this ).bindings;
        for ( const key in bindings ) {
            const binding = bindings[ key ];
            if ( binding ) {
                binding.resume();
            }
        }
        return this;
    },
};
