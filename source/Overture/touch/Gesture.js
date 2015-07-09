// -------------------------------------------------------------------------- \\
// File: Gesture.js                                                           \\
// Module: Touch                                                              \\
// Requires: GestureManager.js                                                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.Gesture = NS.Class({
    init: function ( mixin ) {
        NS.extend( this, mixin );
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

}( O ) );
