import { Class } from '../core/Core';

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
    init ( type, target, mixin ) {
        this.type = type;
        this.target = target;
        this.defaultPrevented = false;
        this.propagationStopped = false;
        Object.assign( this, mixin );
    },

    /**
        Method: O.Event#preventDefault

        Prevent the default action for this event (if any).

        Returns:
            {O.Event} Returns self.
    */
    preventDefault () {
        this.defaultPrevented = true;
        return this;
    },

    /**
        Method: O.Event#stopPropagation

        Stop bubbling the event up to the next target.

        Returns:
            {O.Event} Returns self.
    */
    stopPropagation () {
        this.propagationStopped = true;
        return this;
    },
});
