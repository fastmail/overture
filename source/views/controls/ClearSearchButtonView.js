import { ACTIVE_IN_INPUT } from '../../application/keyboardShortcuts.js';
import { Class } from '../../core/Core.js';
import { ButtonView } from './ButtonView.js';

const ClearSearchButtonView = Class({
    Name: 'ClearSearchButtonView',

    Extends: ButtonView,

    positioning: 'absolute',

    baseClassName: 'v-ClearSearchButton',

    shortcut: 'Ctrl-/',
    shortcutWhenInputFocused: ACTIVE_IN_INPUT,
});

export { ClearSearchButtonView };
