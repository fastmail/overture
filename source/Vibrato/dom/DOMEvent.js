// -------------------------------------------------------------------------- \\
// File: DOMEvent.js                                                          \\
// Module: DOM                                                                \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Namespace: O.DOMEvent

    O.DOMEvent contains functions for use with DOM event objects
*/
var DOMEvent = {
    /**
        Property: O.DomEvent.keys
        Type: Object

        Maps the names of special keys to their key code.
    */
    keys: {
        'enter': 13,
        'up': 38,
        'down': 40,
        'left': 37,
        'right': 39,
        'esc': 27,
        'space': 32,
        'backspace': 8,
        'tab': 9,
        'delete': 46,
        'pageup': 33,
        'pagedown': 34,
        'end': 35,
        'home': 36,
        'shift': 16,
        'control': 17,
        'alt': 18,
        'capslock': 20,
        'numlock': 144
    },

    /**
        Function: O.DomEvent.lookupKey

        Determines which key was pressed to generate the event supplied as an
        argument.

        Parameters:
            event       - {KeyEvent} The W3C DOM event object.
            noModifiers - Unless true, alt-/ctrl-/meta-/shift- will be prepended
                          to the returned value if the respective keys are held
                          down. They will always be in alphabetical order, e.g.
                          If the user pressed 'g' whilst holding down shift and
                          alt, the return value would be 'alt-shift-g'.

        Returns:
            {String} The key pressed (in lowercase if a letter).
    */
    lookupKey: function ( event, noModifiers ) {
        // See http://unixpapa.com/js/key.html. Short summary:
        // event.keyCode || event.which gives the ASCII code for any normal
        // keypress on all browsers. However, if event.which === 0 then it was a
        // special key and so it should be looked up in the table of function
        // keys. Anything from code 32 downwards must also be a special char.
        var code = event.keyCode || event.which,
            isKeyPress = ( event.type === 'keypress' ),
            preferAsci = code > 32 && isKeyPress &&
                event.which !== 0 && event.charCode !== 0,
            str = String.fromCharCode( code ).toLowerCase(),
            key = ( !preferAsci && Object.keyOf( DOMEvent.keys, code ) ) || str,
            altAndShift;

        // Function keys
        if ( !preferAsci && 111 < code && code < 124 ) {
            key = 'f' + ( code - 111 );
        }
        // Append modifiers (use alphabetical order)
        var modifiers = '';
        if ( !noModifiers ) {
            // Different keyboard layouts may require Shift/Alt for non A-Z
            // keys, so we only add meta and ctrl modifiers.
            altAndShift = !isKeyPress || ( /[a-z]/.test( key ) );
            if ( event.altKey && altAndShift ) { modifiers += 'alt-'; }
            if ( event.ctrlKey ) { modifiers += 'ctrl-'; }
            if ( event.metaKey ) { modifiers += 'meta-'; }
            if ( event.shiftKey && altAndShift ) { modifiers += 'shift-'; }
        }

        return modifiers + key;
    }
};

NS.DOMEvent = DOMEvent;

}( this.O ) );
