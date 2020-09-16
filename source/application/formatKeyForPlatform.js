import '../core/String.js'; // For String#capitalise
import { isApple } from '../ua/UA.js';

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

const modifierOrder = (isApple
    ? ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Meta']
    : ['Meta', 'Cmd', 'Ctrl', 'Alt', 'Shift']
).reduce((order, x, index) => {
    order[x] = index + 1;
    return order;
}, {});

const sortModifierKeys = function (a, b) {
    return (modifierOrder[a] || 9) - (modifierOrder[b] || 9);
};

/**
    Function: O.formatKeyForPlatform

    Parameters:
        shortcut - {String} The keyboard shorcut, in the same format as
                   taken by <O.GlobalKeyboardShortcuts#register>.

    Returns:
        {String} The shortcut formatted for display on the user's platform.
*/
const formatKeyForPlatform = function (shortcut) {
    return shortcut
        .split('-')
        .sort(sortModifierKeys)
        .map((key) => platformKeys[key] || key.capitalise())
        .join('');
};

export { formatKeyForPlatform };
