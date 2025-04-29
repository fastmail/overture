/*global document */

import { Event } from '../foundation/Event.js';
import { invokeAfterDelay } from '../foundation/RunLoop.js';
import { getViewFromNode } from '../views/activeViews.js';
import { ViewEventsController } from '../views/ViewEventsController.js';
import { Gesture } from './Gesture.js';

class TapEvent extends Event {}

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
        const activeEls = [];
        let target = touch.target;
        let view = getViewFromNode(target);
        let inScrollView = false;
        while (view) {
            if (view.get('showScrollbarX') || view.get('showScrollbarY')) {
                inScrollView = true;
                break;
            }
            view = view.get('parentView');
        }
        this.timestamp = Date.now();
        this.x = touch.clientX;
        this.y = touch.clientY;
        this.target = target;
        this.touch = touch;
        this.cancelOnMove = inScrollView;
        this.activeEls = activeEls;
        do {
            if (
                /^(?:A|BUTTON|INPUT|LABEL)$/.test(target.nodeName) ||
                (target.classList && target.classList.contains('tap-target'))
            ) {
                activeEls.push(target);
                target.classList.add('tap-active');
            }
        } while ((target = target.parentNode));
        this._ignore = false;
        // If this delay is 400ms or lower, WebKit will reintroduce the 350ms
        // click delay!
        invokeAfterDelay(fireHoldEvent, 450, this);
    }

    done() {
        const activeEls = this.activeEls;
        const l = activeEls.length;
        for (let i = 0; i < l; i += 1) {
            activeEls[i].classList.remove('tap-active');
        }
        this._ignore = true;
    }
}

const getParents = function (node) {
    const parents = [];
    while (node) {
        parents.push(node);
        node = node.parentNode;
    }
    parents.reverse();
    return parents;
};

const getCommonAncestor = function (a, b) {
    const parentsA = getParents(a);
    const parentsB = getParents(b);
    for (let i = 0; true; i += 1) {
        if (parentsA[i] !== parentsB[i]) {
            return i ? parentsA[i - 1] : null;
        }
    }
};

/*  A tap is defined as a touch which starts and finishes within the same node,
    and either is not in a scroll view or moves less than 5px from the initial
    touch point.

    There may be other touches occurring at the same time (e.g. you could be
    holding one button and tap another; the tap gesture will still be
    recognised).
*/
const tap = new Gesture({
    _tracking: {},

    cancel() {
        const tracking = this._tracking;
        for (const id in tracking) {
            tracking[id].done();
        }
        this._tracking = {};
    },

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

    move(event) {
        const touches = event.changedTouches;
        const tracking = this._tracking;
        const l = touches.length;
        for (let i = 0; i < l; i += 1) {
            const touch = touches[i];
            const id = touch.identifier;
            const trackedTouch = tracking[id];
            if (trackedTouch && trackedTouch.cancelOnMove) {
                const deltaX = touch.clientX - trackedTouch.x;
                const deltaY = touch.clientY - trackedTouch.y;
                if (deltaX * deltaX + deltaY * deltaY > 25) {
                    trackedTouch.done();
                    delete tracking[id];
                }
            }
        }
    },

    scroll() {
        this.cancel();
    },

    end(event) {
        const touches = event.changedTouches;
        const tracking = this._tracking;
        const l = touches.length;
        for (let i = 0; i < l; i += 1) {
            const touch = touches[i];
            const id = touch.identifier;
            const trackedTouch = tracking[id];
            if (trackedTouch) {
                const { clientX, clientY } = touch;
                // Android Chrome gives bogus values sometimes, which I think
                // are Infinity. Check it's finite before using.
                let target =
                    0 <= clientX &&
                    clientX < Infinity &&
                    0 <= clientY &&
                    clientY < Infinity
                        ? document.elementFromPoint(clientX, clientY)
                        : null;
                const initialTarget = trackedTouch.target;
                const duration = Date.now() - trackedTouch.timestamp;
                if (target && target !== initialTarget) {
                    target = getCommonAncestor(target, initialTarget);
                }
                if (target) {
                    const tapEvent = new TapEvent('tap', target, {
                        duration,
                        touch,
                    });
                    ViewEventsController.handleEvent(tapEvent);
                }
                trackedTouch.done();
                delete tracking[id];
            }
        }
    },
});

export { tap };
