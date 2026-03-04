/**
    Namespace: O.DOMEvent

    O.DOMEvent contains functions for use with DOM event objects
*/

/**
    Function: O.DOMEvent.lookupKey

    Determines which key was pressed to generate the event supplied as an
    argument.

    Parameters:
        event       - {KeyEvent} The W3C DOM event object.
        noModifiers - Unless true, Alt-/Ctrl-/Meta-/Shift- will be prepended
                      to the returned value if the respective keys are held
                      down. They will always be in alphabetical order, e.g.
                      If the user pressed 'g' whilst holding down Shift and
                      Alt, the return value would be 'Alt-Shift-G'.

    Returns:
        {String} The key pressed (in lowercase if a letter).
*/
const lookupKey = function (event, noModifiers) {
    const isKeyPress = event.type === 'keypress';

    let key = event.key;
    if (event.altKey) {
        // event.key gives alternate characters when Alt is held (e.g. å for
        // Alt-A on Mac); use event.code to get the base key instead.
        const code = event.code;
        if (code.startsWith('Key')) {
            key = code.charAt(3);
        } else if (code.startsWith('Digit')) {
            key = code.charAt(5);
        }
    }
    if (key === ' ') {
        key = 'Space';
    }

    // Ignore caps-lock
    if (/^[A-Za-z]$/.test(key)) {
        key = event.shiftKey ? key.toUpperCase() : key.toLowerCase();
    }

    // Append modifiers (use alphabetical order)
    let modifiers = '';
    if (!noModifiers) {
        // Different keyboard layouts may require Shift/Alt for non A-Z
        // keys, so we only add meta and ctrl modifiers.
        const altAndShift = !isKeyPress || /[a-z]/.test(key);
        if (event.altKey && altAndShift) {
            modifiers += 'Alt-';
        }
        if (event.ctrlKey) {
            modifiers += 'Ctrl-';
        }
        if (event.metaKey) {
            modifiers += 'Meta-';
        }
        if (event.shiftKey && altAndShift) {
            modifiers += 'Shift-';
        }
    }

    return modifiers + key;
};

/**
    Function: O.DOMEvent.isClickModified

    Determines if a secondary mouse button was pressed, or a modifier key
    was held down while the mouse was clicked.

    Parameters:
        event - {MouseEvent} The W3C DOM click event object.

    Returns:
        {Boolean} Was a secondary button clicked or modifier held down?
*/
const isClickModified = function (event) {
    return (
        !!event.button ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
    );
};

export { lookupKey, isClickModified };
