import { Class } from '../../core/Core';
import ButtonView from './ButtonView';

const ClearSearchButtonView = Class({

    Extends: ButtonView,

    type: 'v-ClearSearchButton',
    positioning: 'absolute',
    shortcut: 'ctrl-/',
});

export default ClearSearchButtonView;
