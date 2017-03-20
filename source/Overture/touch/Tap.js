// -------------------------------------------------------------------------- \\
// File: Tap.js                                                               \\
// Module: Touch                                                              \\
// Requires: Core, Foundation, DOM, View, Gesture.js                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';
import Event from '../foundation/Event.js';
import Element from '../dom/Element.js';
import ViewEventsController from '../views/ViewEventsController.js';
import Gesture from './Gesture.js';

/*  We can't just call preventDefault on touch(start|move), as this would
    prevent scrolling and also prevent links we want to act as normal from
    working. So we use this hack instead to capture the subsequent click and
    remove it from the app's existence.
*/
var MouseEventRemover = Class({
    init: function ( target, defaultPrevented ) {
        this.target = target;
        this.stop = defaultPrevented;
        this.time = Date.now();
        ViewEventsController.addEventTarget( this, 40 );
    },
    fire: function ( type, event ) {
        var isClick = ( type === 'click' ) && !event.originalType,
            isMouse = isClick || /^mouse/.test( type );
        if ( type === 'touchstart' || Date.now() - this.time > 1000 ) {
            ViewEventsController.removeEventTarget( this );
            isMouse = false;
        }
        if ( isMouse && ( this.stop || event.target !== this.target ) ) {
            event.preventDefault();
        }
        event.propagationStopped = isMouse;
    }
});

var TapEvent = Class({

    Extends: Event,

    originalType: 'tap'
});

var TrackedTouch = function ( x, y, time, target ) {
    this.x = x;
    this.y = y;
    this.time = time;
    var activeEls = this.activeEls = [];
    do {
        if ( /^(?:A|BUTTON|INPUT|LABEL)$/.test( target.nodeName ) ) {
            activeEls.push( target );
            Element.addClass( target, 'tap-active' );
        }
    } while ( target = target.parentNode );
};

TrackedTouch.prototype.done  = function () {
    var activeEls = this.activeEls,
        i, l;
    for ( i = 0, l = activeEls.length; i < l; i += 1 ) {
        Element.removeClass( activeEls[i], 'tap-active' );
    }
};

var isInputOrLink = function ( node ) {
    var nodeName = node.nodeName;
    var seenLink = false;
    if ( nodeName === 'INPUT' ||
        nodeName === 'BUTTON' ||
        nodeName === 'TEXTAREA' ||
        nodeName === 'SELECT' ) {
        return true;
    }
    while ( node && node.contentEditable === 'inherit' ) {
        if ( node.nodeName === 'A' ) {
            seenLink = true;
        }
        node = node.parentNode;
    }
    if ( node && node.contentEditable === 'true' ) {
        return true;
    }
    while ( !seenLink && node ) {
        if ( node.nodeName === 'A' ) {
            seenLink = true;
        }
        node = node.parentNode;
    }
    return seenLink;
};

/*  A tap is defined as a touch which:

    * Lasts less than 200ms.
    * Moves less than 5px from the initial touch point.

    There may be other touches occurring at the same time (e.g. you could be
    holding one button and tap another; the tap gesture will still be
    recognised).
*/
export default new Gesture({

    _tracking: {},

    cancel: function () {
        var tracking = this._tracking,
            id;
        for ( id in tracking ) {
            tracking[ id ].done();
        }
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
                tracking[ id ] = new TrackedTouch(
                    touch.screenX, touch.screenY, now, touch.target );
            }
        }
    },

    move: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            i, l, touch, id, trackedTouch, deltaX, deltaY;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            trackedTouch = tracking[ id ];
            if ( trackedTouch ) {
                deltaX = touch.screenX - trackedTouch.x;
                deltaY = touch.screenY - trackedTouch.y;
                if ( deltaX * deltaX + deltaY * deltaY > 25 ) {
                    trackedTouch.done();
                    delete tracking[ id ];
                }
            }
        }
    },

    end: function ( event ) {
        var touches = event.changedTouches,
            tracking = this._tracking,
            now = Date.now(),
            i, l, touch, id, trackedTouch, target, tapEvent, clickEvent,
            ViewEventsController = ViewEventsController;
        for ( i = 0, l = touches.length; i < l; i += 1 ) {
            touch = touches[i];
            id = touch.identifier;
            trackedTouch = tracking[ id ];
            if ( trackedTouch ) {
                if ( now - trackedTouch.time < 200 ) {
                    target = touch.target;
                    tapEvent = new TapEvent( 'tap', target );
                    ViewEventsController.handleEvent( tapEvent );
                    clickEvent = new TapEvent( 'click', target );
                    clickEvent.defaultPrevented = tapEvent.defaultPrevented;
                    ViewEventsController.handleEvent( clickEvent );
                    // The tap could trigger a UI change. When the click event
                    // is fired 300ms later, if there is now an input under the
                    // area the touch took place, in iOS the keyboard will
                    // appear, even though the preventDefault on the click event
                    // stops it actually being focussed. Calling preventDefault
                    // on the touchend event stops this happening, however we
                    // must not do this if the user actually taps an input or
                    // a link!
                    if ( !isInputOrLink( target ) ) {
                        event.preventDefault();
                    }
                    new MouseEventRemover( target, clickEvent.defaultPrevented );
                }
                trackedTouch.done();
                delete tracking[ id ];
            }
        }
    }
});
