// -------------------------------------------------------------------------- \\
// File: DOMEvent.js                                                          \\
// Module: DOM                                                                \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/**
    Namespace: O.DOMEvent

    O.DOMEvent contains functions for use with DOM event objects
*/
var DOMEvent = {
    /**
        Property: O.DOMEvent.keys
        Type: Object

        Maps the names of special keys to their key code.
    */
    keys: {
        8: 'backspace',
        9: 'tab',
        13: 'enter',
        16: 'shift',
        17: 'control',
        18: 'alt',
        20: 'capslock',
        27: 'esc',
        32: 'space',
        33: 'pageup',
        34: 'pagedown',
        35: 'end',
        36: 'home',
        37: 'left',
        38: 'up',
        39: 'right',
        40: 'down',
        46: 'delete',
        144: 'numlock',
    },

    /**
        Function: O.DOMEvent.lookupKey

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
            preferAsci = isKeyPress && code > 32 &&
                event.which !== 0 && event.charCode !== 0,
            str = String.fromCharCode( code ).toLowerCase(),
            key = ( !preferAsci && DOMEvent.keys[ code ] ) || str,
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
    },

    /**
        Function: O.DOMEvent.isClickModified

        Determines if a secondary mouse button was pressed, or a modifier key was held down while the mouse was clicked.

        Parameters:
            event - {MouseEvent} The W3C DOM click event object.

        Returns:
            {Boolean} Was a secondary button clicked or modifier held down?
    */
    isClickModified: function ( event ) {
        return !!event.button ||
            event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    },
};

export default DOMEvent;
