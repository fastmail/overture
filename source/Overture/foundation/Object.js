// -------------------------------------------------------------------------- \\
// File: Object.js                                                            \\
// Module: Foundation                                                         \\
// Requires: ComputedProps.js, BoundProps.js, ObservableProps.js, EventTarget.js \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var meta = NS.meta;

/**
    Class: O.Object

    Includes: O.ComputedProps, O.BoundProps, O.ObservableProps, O.EventTarget

    This is the root class for almost every object in the rest of the library.
    It adds support for computed properties, bound properties, observable
    properties and subscribing/firing events.
*/
NS.Object = NS.Class({

    Mixin: [
        NS.ComputedProps, NS.BoundProps, NS.ObservableProps, NS.EventTarget
    ],

    /**
        Constructor: O.Object

        Parameters:
            mixin - {Object} (optional) Any properties in this object will be
                    added to the new O.Object instance before initialisation (so
                    you can pass it getter/setter functions or observing
                    methods).
    */
    init: function ( mixin ) {
        this.isDestroyed = false;

        NS.mixin( this, mixin );

        var metadata = meta( this ),
            inits = metadata.inits,
            method;
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
    }
});

}( O ) );
