// -------------------------------------------------------------------------- \\
// File: Gesture.js                                                           \\
// Module: Touch                                                              \\
// Requires: Core, GestureManager.js                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class, extend } from '../core/Core.js';
import GestureManager from './GestureManager.js';

export default Class({
    init: function ( mixin ) {
        extend( this, mixin );
        GestureManager.register( this );
    },
    destroy: function () {
        GestureManager.deregister( this );
    },
    cancel: function () {},
    start: function () {},
    move: function () {},
    end: function () {},
});
