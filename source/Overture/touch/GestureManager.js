// -------------------------------------------------------------------------- \\
// File: GestureManager.js                                                    \\
// Module: Touch                                                              \\
// Requires: View                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

var GestureManager = new NS.Object({

    _gestures: [],

    register: function ( gesture ) {
        this._gestures.push( gesture );
    },

    deregister: function ( gesture ) {
        this._gestures.erase( gesture );
    },

    isMouseDown: false,

    fire: function ( type, event ) {
        if ( /^touch/.test( type ) ) {
            var gestures = this._gestures,
                l = gestures.length;
            type = type.slice( 5 );
            while ( l-- ) {
                gestures[l][ type ]( event );
            }
        }
        if ( !event.button ) {
            if ( type === 'mousedown' ) {
                this.set( 'isMouseDown', true );
            }
            if ( type === 'mouseup' ) {
                this.set( 'isMouseDown', false );
            }
        }
        return false;
    }
});

NS.ViewEventsController.addEventTarget( GestureManager, 30 );

NS.GestureManager = GestureManager;

}( O ) );
