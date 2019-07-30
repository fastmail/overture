import '../core/String';  // For String#capitalise
import { isMac } from '../ua/UA';

const platformKeys = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowRight: '→',
    ArrowLeft: '←',
    Alt: isMac ? '⌥' : 'Alt-',
    Cmd: isMac ? '⌘' : 'Ctrl-',
    Ctrl: isMac ? '⌃' : 'Ctrl-',
    Meta: isMac ? '⌘' : 'Meta-',
    Shift: isMac ? '⇧' : 'Shift-',
    Escape: 'Esc',
    Enter: isMac ? '↵' : 'Enter',
    Backspace: isMac ? '⌫' : 'Backspace',
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
    return shortcut.split( '-' ).map(
        key => platformKeys[ key ] || key.capitalise()
    ).join( '' );
}
