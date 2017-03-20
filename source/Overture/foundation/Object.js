import ComputedProps from './ComputedProps.js';
import BoundProps from './BoundProps.js';
import ObservableProps from './ObservableProps.js';
import EventTarget from './EventTarget.js';

import { Class, meta, mixin } from '../core/Core.js';

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
    init: function (/* ...mixins */) {
        var i, l, metadata, inits, method;

        this.isDestroyed = false;

        for ( i = 0, l = arguments.length; i < l; i += 1 ) {
            mixin( this, arguments[i] );
        }

        metadata = meta( this );
        inits = metadata.inits;
        for ( method in inits ) {
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
    destroy: function () {
        var destructors = meta( this ).inits,
            method;
        for ( method in destructors ) {
            if ( destructors[ method ] ) {
                this[ 'destroy' + method ]();
            }
        }

        this.isDestroyed = true;
    },
});
