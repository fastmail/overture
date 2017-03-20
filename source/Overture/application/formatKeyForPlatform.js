// -------------------------------------------------------------------------- \\
// File: formatKeyForPlatform.js                                              \\
// Module: Application                                                        \\
// Requires: Core, UA                                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import '../core/String.js';  // For String#capitalise
import UA from '../ua/UA.js';

var isMac = UA.isMac;
var platformKeys = {
    alt: isMac ? '⌥' : 'Alt-',
    cmd: isMac ? '⌘' : 'Ctrl-',
    meta: isMac ? '⌘' : 'Meta-',
    shift: isMac ? '⇧' : 'Shift-',
    enter: isMac ? '↵' : 'Enter',
    backspace: isMac ? '⌫' : 'Backspace'
};

/**
    Function: O.formatKeyForPlatform

    Parameters:
        shortcut - {String} The keyboard shorcut, in the same format as
                   taken by <O.GlobalKeyboardShortcuts#register>.

    Returns:
        {String} The shortcut formatted for display on the user's platform.
*/
export default function formatKeyForPlatform ( shortcut ) {
    return shortcut.split( '-' ).map( function ( key ) {
        return platformKeys[ key ] || key.capitalise();
    }).join( '' );
}
