/*global document */

import '../core/Array.js';  // For Array#erase
import Object from '../foundation/Object.js';
import ViewEventsController from '../views/ViewEventsController.js';

var GestureManager = new Object({

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
        event.propagationStopped = false;
    },
});

ViewEventsController.addEventTarget( GestureManager, 30 );

export default GestureManager;
