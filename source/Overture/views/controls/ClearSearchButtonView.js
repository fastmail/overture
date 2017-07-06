import { Class } from '../../core/Core.js';
import ButtonView from './ButtonView.js';

const ClearSearchButtonView = Class({

    Extends: ButtonView,

    type: 'v-ClearSearchButton',
    positioning: 'absolute',
    shortcut: 'ctrl-/',
});

export default ClearSearchButtonView;
