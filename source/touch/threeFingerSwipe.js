import { Event } from '../foundation/Event.js';
import { ViewEventsController } from '../views/ViewEventsController.js';
import { Gesture } from './Gesture.js';

const touchCenter = function (event) {
    const touchMap = [];
    for (let i = 0; i < event.touches.length; i += 1) {
        const { identifier, screenX, screenY } = event.touches[i];
        touchMap[identifier] = { x: screenX, y: screenY };
    }
    for (let i = 0; i < event.changedTouches.length; i += 1) {
        const { identifier, screenX, screenY } = event.changedTouches[i];
        touchMap[identifier] = { x: screenX, y: screenY };
    }
    const touches = Object.values(touchMap);

    let x = 0;
    let y = 0;
    for (let i = 0; i < touches.length; i += 1) {
        x += touches[i].x;
        y += touches[i].y;
    }
    x /= touches.length;
    y /= touches.length;

    return { x, y };
};

const threeFingerSwipe = new Gesture({
    _touchStartPosition: null,

    start(event) {
        if (event.touches.length !== 3) {
            return;
        }
        this._touchStartPosition = touchCenter(event);
    },

    end(event) {
        const startPosition = this._touchStartPosition;
        this._touchStartPosition = null;
        if (!startPosition || event.touches > 3) {
            return;
        }

        const endPosition = touchCenter(event);
        const deltaX = endPosition.x - startPosition.x;
        const deltaY = endPosition.y - startPosition.y;

        const magnitude = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
        const angle = Math.abs((Math.atan2(deltaX, deltaY) * 180) / Math.PI);

        if (magnitude > 20 && angle > 75 && angle < 105) {
            ViewEventsController.handleEvent(
                new Event('threeFingerSwipe', event.target, {
                    direction: deltaX < 0 ? 'left' : 'right',
                }),
            );
        }
    },
});

export { threeFingerSwipe };
