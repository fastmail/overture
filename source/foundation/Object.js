import ComputedProps from './ComputedProps';
import BoundProps from './BoundProps';
import ObservableProps from './ObservableProps';
import EventTarget from './EventTarget';

import { Class, meta, mixin } from '../core/Core';

/**
    Class: O.Object

    Includes: O.ComputedProps, O.BoundProps, O.ObservableProps, O.EventTarget

    This is the root class for almost every object in the rest of the library.
    It adds support for computed properties, bound properties, observable
    properties and subscribing/firing events.
*/
export default Class({

    Mixin: [
        ComputedProps, BoundProps, ObservableProps, EventTarget,
    ],

    /**
        Constructor: O.Object

        Parameters:
            ...mixins - {Object} (optional) Each argument passed will be treated
                        as an object, with any properties in that object added
                        to the new O.Object instance before initialisation (so
                        you can pass it getter/setter functions or observing
                        methods).
    */
    init (/* ...mixins */) {
        this.isDestroyed = false;

        for ( let i = 0, l = arguments.length; i < l; i += 1 ) {
            mixin( this, arguments[i] );
        }

        const metadata = meta( this );
        const inits = metadata.inits;
        for ( const method in inits ) {
            if ( inits[ method ] ) {
                this[ 'init' + method ]();
            }
        }
        metadata.isInitialised = true;
    },

    /**
        Method: O.Object#destroy

        Removes any connections to other objects (e.g. path observers and
        bindings) so the object will be available for garbage collection.
    */
    destroy () {
        const destructors = meta( this ).inits;
        for ( const method in destructors ) {
            if ( destructors[ method ] ) {
                this[ 'destroy' + method ]();
            }
        }

        this.isDestroyed = true;
    },
});
