import '../core/Array.js'; // For Array#erase
import { Obj } from '../foundation/Object.js';
import { ViewEventsController } from '../views/ViewEventsController.js';

const GestureManager = new Obj({
    _gestures: [],

    register(gesture) {
        this._gestures.push(gesture);
    },

    deregister(gesture) {
        this._gestures.erase(gesture);
    },

    isMouseDown: false,

    fire(type, event) {
        if (/^touch/.test(type)) {
            const gestures = this._gestures;
            let l = gestures.length;
            type = type.slice(5);
            while (l--) {
                gestures[l][type](event);
            }
        }
        if (!event.button) {
            if (type === 'mousedown') {
                this.set('isMouseDown', true);
            }
            if (type === 'mouseup') {
                this.set('isMouseDown', false);
            }
        }
        event.propagationStopped = false;
    },
});

ViewEventsController.addEventTarget(GestureManager, 30);

export { GestureManager };
