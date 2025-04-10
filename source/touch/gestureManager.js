import { Obj } from '../foundation/Object.js';
import { POINTER_DOWN, POINTER_UP } from '../views/View.js';
import { ViewEventsController } from '../views/ViewEventsController.js';

import '../core/Array.js'; // For Array#erase

const gestureManager = new Obj({
    _gestures: [],

    register(gesture) {
        this._gestures.push(gesture);
        return this;
    },

    deregister(gesture) {
        this._gestures.erase(gesture);
        return this;
    },

    isMouseDown: false,

    fire(type, event) {
        switch (true) {
            case /^touch/.test(type):
                type = type.slice(5);
            /* falls through */
            case type === 'scroll': {
                const gestures = this._gestures;
                for (let i = gestures.length - 1; i >= 0; i -= 1) {
                    gestures[i][type](event);
                }
            }
        }
        if (!event.button) {
            if (type === POINTER_DOWN) {
                this.set('isMouseDown', true);
            }
            if (type === POINTER_UP) {
                this.set('isMouseDown', false);
            }
        }
        event.propagationStopped = false;
    },
});

ViewEventsController.addEventTarget(gestureManager, 30);

export { gestureManager };
