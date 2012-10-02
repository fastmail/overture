// -------------------------------------------------------------------------- \\
// File: Gesture.js                                                           \\
// Module: Touch                                                              \\
// Requires: GestureManager.js                                                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.Gesture = NS.Class({
    init: function ( options ) {
        NS.extend( this, options );
        NS.GestureManager.register( this );
    },
    destroy: function () {
        NS.GestureManager.deregister( this );
    },
    cancel: function () {},
    start: function () {},
    move: function () {},
    end: function () {}
});

}( this.O ) );
