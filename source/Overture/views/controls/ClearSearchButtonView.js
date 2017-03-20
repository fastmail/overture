// -------------------------------------------------------------------------- \\
// File: ClearSearchButtonView.js                                             \\
// Module: ControlViews                                                       \\
// Requires: Core, ButtonView.js                                              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../../core/Core.js';
import ButtonView from './ButtonView.js';

var ClearSearchButtonView = new Class({

    Extends: ButtonView,

    type: 'v-ClearSearchButton',
    positioning: 'absolute',
    shortcut: 'ctrl-/'
});

export default ClearSearchButtonView;
