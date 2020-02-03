import { Class } from '../../core/Core';
import ButtonView from './ButtonView';
import { ACTIVE_IN_INPUT } from '../../application/keyboardShortcuts.js';

const ClearSearchButtonView = Class({

    Extends: ButtonView,

    className: 'v-ClearSearchButton',
    shortcut: 'Ctrl-/',
    shortcutWhenInputFocused: ACTIVE_IN_INPUT,
});

export default ClearSearchButtonView;
