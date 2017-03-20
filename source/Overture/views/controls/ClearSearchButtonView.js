import { Class } from '../../core/Core.js';
import ButtonView from './ButtonView.js';

var ClearSearchButtonView = new Class({

    Extends: ButtonView,

    type: 'v-ClearSearchButton',
    positioning: 'absolute',
    shortcut: 'ctrl-/',
});

export default ClearSearchButtonView;
