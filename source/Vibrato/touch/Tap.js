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
        this.time = Date.now();
        this.target = target;
        this.stop = defaultPrevented;
        this.activate();
    },
    // If a pop over view opens during the render phase, it may usurped us, so
    // we wait until the 'after' phase to add ourselves to the responder queue.
    activate: function () {
        NS.ViewEventsController.pushEventTarget( this );
    }.queue( 'after' ),
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
            i, l, touch, id, start, defaultPrevented, tapEvent,
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
                    tapEvent = {
                        isEvent: true,
                        originalType: 'tap',
                        type: 'tap',
                        target: touch.target,
                        preventDefault: preventDefault
                    };
                    ViewEventsController.handleEvent( tapEvent );
                    tapEvent.type = 'click';
                    ViewEventsController.handleEvent( tapEvent );
                    new MouseEventRemover( touch.target, defaultPrevented );
                }
                delete tracking[ id ];
            }
        }
    }
});

}( this.O ) );
