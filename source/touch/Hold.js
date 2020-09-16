import { Event } from '../foundation/Event.js';
import { invokeAfterDelay } from '../foundation/RunLoop.js';
import { ViewEventsController } from '../views/ViewEventsController.js';
import { Tap } from './Tap.js';
import { Gesture } from './Gesture.js';

class HoldEvent extends Event {
    constructor(touch) {
        super('hold', touch.target);
        this.touch = touch;
    }
}

const fireHoldEvent = function () {
    if (!this._ignore) {
        ViewEventsController.handleEvent(new HoldEvent(this.touch));
    }
};

class TrackedTouch {
    constructor(touch) {
        this.touch = touch;
        this.x = touch.screenX;
        this.y = touch.screenY;
        this.target = touch.target;
        this.cancelOnMove = true;
        this._ignore = false;
        invokeAfterDelay(fireHoldEvent, 750, this);
    }

    done() {
        this._ignore = true;
    }
}

/*  A hold is defined as a touch which:

    * Lasts at least 750ms.
    * Moves less than 5px from the initial touch point.
*/
const Hold = new Gesture({
    _tracking: {},

    cancel: Tap.cancel,

    start(event) {
        const touches = event.changedTouches;
        const tracking = this._tracking;
        const l = touches.length;
        for (let i = 0; i < l; i += 1) {
            const touch = touches[i];
            const id = touch.identifier;
            if (!tracking[id]) {
                tracking[id] = new TrackedTouch(touch);
            }
        }
    },

    move: Tap.move,

    end(event) {
        const touches = event.changedTouches;
        const tracking = this._tracking;
        const l = touches.length;
        for (let i = 0; i < l; i += 1) {
            const touch = touches[i];
            const id = touch.identifier;
            const trackedTouch = tracking[id];
            if (trackedTouch) {
                trackedTouch.done();
                delete tracking[id];
            }
        }
    },
});

export { Hold };
