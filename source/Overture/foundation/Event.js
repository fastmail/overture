// -------------------------------------------------------------------------- \\
// File: Event.js                                                             \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class, extend } from '../core/Core.js';

/**
    Class: O.Event

    Represents a synthetic event.
*/
export default Class({

    /**
        Constructor: O.Event

        Parameters:
            type   - {String} The event type.
            target - {Object} The target on which the event is to fire.
            mixin  - {Object} (optional) Any further properties to add to the
                     event.
    */
    init: function ( type, target, mixin ) {
        this.type = type;
        this.target = target;
        this.defaultPrevented = false;
        this.propagationStopped = false;
        extend( this, mixin );
    },

    /**
        Method: O.Event#preventDefault

        Prevent the default action for this event (if any).

        Returns:
            {O.Event} Returns self.
    */
    preventDefault: function () {
        this.defaultPrevented = true;
        return this;
    },

    /**
        Method: O.Event#stopPropagation

        Stop bubbling the event up to the next target.

        Returns:
            {O.Event} Returns self.
    */
    stopPropagation: function () {
        this.propagationStopped = true;
        return this;
    }
});
