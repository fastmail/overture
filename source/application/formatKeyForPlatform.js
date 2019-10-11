import '../core/String';  // For String#capitalise
import { isApple } from '../ua/UA';

const platformKeys = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowRight: '→',
    ArrowLeft: '←',
    Alt: isApple ? '⌥' : 'Alt-',
    Cmd: isApple ? '⌘' : 'Ctrl-',
    Ctrl: isApple ? '⌃' : 'Ctrl-',
    Meta: isApple ? '⌘' : 'Meta-',
    Shift: isApple ? '⇧' : 'Shift-',
    Escape: 'Esc',
    Enter: isApple ? '↵' : 'Enter',
    Backspace: isApple ? '⌫' : 'Backspace',
    Delete: isApple ? '⌦' : 'Delete',
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
