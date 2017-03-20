// -------------------------------------------------------------------------- \\
// File: Hold.js                                                              \\
// Module: Touch                                                              \\
// Requires: Core, Foundation, View, Tap.js, Gesture.js                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';
import Event from '../foundation/Event.js';
import RunLoop from '../foundation/RunLoop.js';
import ViewEventsController from '../views/ViewEventsController.js';
import Tap from './Tap.js';
import Gesture from './Gesture.js';

var HoldEvent = Class({

    Extends: Event,

    init: function ( touch ) {
        HoldEvent.parent.init.call( this, 'hold', touch.target );
        this.touch = touch;
    }
});

var fireHoldEvent = function () {
    if ( !this._ignore ) {
        ViewEventsController.handleEvent(
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
    RunLoop.invokeAfterDelay( fireHoldEvent, 750, this );
};

TrackedTouch.prototype.done = function () {
    this._ignore = true;
};

/*  A hold is defined as a touch which:

    * Lasts at least 750ms.
    * Moves less than 5px from the initial touch point.
*/
export default new Gesture({

    _tracking: {},

    cancel: Tap.cancel,

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

    move: Tap.move,

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
