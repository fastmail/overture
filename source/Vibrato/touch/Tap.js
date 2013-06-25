// -------------------------------------------------------------------------- \\
// File: Tap.js                                                               \\
// Module: Touch                                                              \\
// Requires: Gesture.js                                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

/*  We can't just call preventDefault on touch(start|move), as this would
    prevent scrolling and also prevent links we want to act as normal from
    working. So we use this hack instead to capture the subsequent click and
    remove it from the app's existence.
*/
var MouseEventRemover = NS.Class({
    init: function ( target, defaultPrevented ) {
        this.target = target;
        this.stop = defaultPrevented;
        NS.ViewEventsController.addEventTarget( this, 30 );
    },
    fire: function ( type, event ) {
        var isClick = ( type === 'click' ) && !event.originalType,
            isMouse = isClick || /^mouse/.test( type );
        if ( isMouse && ( this.stop || event.target !== this.target ) ) {
            event.preventDefault();
        }
        if ( type === 'touchstart' ) {
            NS.ViewEventsController.removeEventTarget( this );
        }
        return isMouse;
    }
});

var TapEvent = function ( type, target, preventDefault ) {
    this.isEvent = true;
    this.type = type;
    this.originalType = 'tap';
    this.target = target;
    this.preventDefault = preventDefault;
};

/*  A tap is defined as a touch which:

    * Lasts less than 200ms.
    * Moves less than 10px from the initial touch point.

    There may be other touches occurring at the same time (e.g. you could be
    holding one button and tap another; the tap gesture will still be
    recognised).
*/
NS.Tap = new NS.Gesture({

    _tracking: {},

    cancel: function () {
        this._tracking = {};
    },

    start: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            now = Date.now(),
            i, l, touch, id;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            if ( !tracking[ id ] ) {
                tracking[ id ] = {
                    x: touch.screenX,
                    y: touch.screenY,
                    time: now
                };
            }
        }
    },

    move: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            i, l, touch, id, start, deltaX, deltaY;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            start = tracking[ id ];
            if ( start ) {
                deltaX = touch.screenX - start.x;
                deltaY = touch.screenY - start.y;
                if ( deltaX * deltaX + deltaY * deltaY > 100 ) {
                    delete tracking[ id ];
                }
            }
        }
    },

    end: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            now = Date.now(),
            i, l, touch, id, start, defaultPrevented, target,
            ViewEventsController = NS.ViewEventsController,
            preventDefault = function () {
                defaultPrevented = true;
            };
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            start = tracking[ id ];
            if ( start ) {
                if ( now - start.time < 200 ) {
                    defaultPrevented = false;
                    target = touch.target;
                    ViewEventsController.handleEvent(
                        new TapEvent( 'tap', target, preventDefault )
                    );
                    ViewEventsController.handleEvent(
                        new TapEvent( 'click', target, preventDefault )
                    );
                    new MouseEventRemover( target, defaultPrevented );
                }
                delete tracking[ id ];
            }
        }
    }
});

}( this.O ) );
