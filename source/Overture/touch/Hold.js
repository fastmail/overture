// -------------------------------------------------------------------------- \\
// File: Hold.js                                                              \\
// Module: Touch                                                              \\
// Requires: Gesture.js, Tap.js                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var HoldEvent = function ( touch ) {
    this.isEvent = true;
    this.type = 'hold';
    this.touch = touch;
    this.target = touch.target;
};

var fireHoldEvent = function () {
    if ( !this._ignore ) {
        NS.ViewEventsController.handleEvent(
            new HoldEvent( this.touch )
        );
    }
};

var TrackedTouch = function ( touch ) {
    this.touch = touch;
    this.x = touch.screenX;
    this.y = touch.screenY;
    this.target = touch.target;
    this._ignore = false;
    NS.RunLoop.invokeAfterDelay( fireHoldEvent, 750, this );
};

TrackedTouch.prototype.done = function () {
    this._ignore = true;
};

/*  A hold is defined as a touch which:

    * Lasts at least 750ms.
    * Moves less than 5px from the initial touch point.
*/
NS.Hold = new NS.Gesture({

    _tracking: {},

    cancel: NS.Tap.cancel,

    start: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            i, l, touch, id;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            if ( !tracking[ id ] ) {
                tracking[ id ] = new TrackedTouch( touch );
            }
        }
    },

    move: NS.Tap.move,

    end: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            i, l, touch, id, trackedTouch;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            trackedTouch = tracking[ id ];
            if ( trackedTouch ) {
                trackedTouch.done();
                delete tracking[ id ];
            }
        }
    }
});

}( O ) );

