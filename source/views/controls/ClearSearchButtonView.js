import { formatKeyForPlatform } from '../../application/formatKeyForPlatform.js';
import { ACTIVE_IN_INPUT } from '../../application/keyboardShortcuts.js';
import { Class } from '../../core/Core.js';
import { loc } from '../../localisation/i18n.js';
import { ButtonView } from './ButtonView.js';

const ClearSearchButtonView = Class({
    Name: 'ClearSearchButtonView',

    Extends: ButtonView,

    positioning: 'absolute',

    baseClassName: 'v-ClearSearchButton',

    tooltip: function () {
        return loc('Shortcut: {value1}', formatKeyForPlatform('Ctrl-/'));
    }.property(),

    // Alternatives are for AZERTY keyboard
    shortcut: 'Ctrl-/ Ctrl-Shift-/ Ctrl-Shift-:',
    shortcutWhenInputFocused: ACTIVE_IN_INPUT,
});

export { ClearSearchButtonView };
