/*global document */

import { Event } from '../foundation/Event.js';
import { getViewFromNode } from '../views/activeViews.js';
import { ViewEventsController } from '../views/ViewEventsController.js';
import { Gesture } from './Gesture.js';

/*  We can't just call preventDefault on touch(start|move), as this would
    prevent scrolling and also prevent links we want to act as normal from
    working. So we use this hack instead to capture the subsequent click and
    remove it from the app's existence.
*/
class MouseEventRemover {
    constructor(target, defaultPrevented) {
        this.target = target;
        this.stop = defaultPrevented;
        this.time = Date.now();
        ViewEventsController.addEventTarget(this, 40);
    }
    fire(type, event) {
        const isClick = type === 'click' && !event.originalType;
        let isMouse = isClick || /^mouse/.test(type);
        if (type === 'touchstart' || Date.now() - this.time > 1000) {
            ViewEventsController.removeEventTarget(this);
            isMouse = false;
        }
        if (isMouse && (this.stop || event.target !== this.target)) {
            event.preventDefault();
        }
        event.propagationStopped = isMouse;
    }
}

class TapEvent extends Event {}

TapEvent.prototype.originalType = 'tap';

class TrackedTouch {
    constructor(x, y, target) {
        const activeEls = [];
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
        this.x = x;
        this.y = y;
        this.target = target;
        this.cancelOnMove = inScrollView;
        this.activeEls = activeEls;
        do {
            if (/^(?:A|BUTTON|INPUT|LABEL)$/.test(target.nodeName)) {
                activeEls.push(target);
                target.classList.add('tap-active');
            }
        } while ((target = target.parentNode));
    }

    done() {
        const activeEls = this.activeEls;
        const l = activeEls.length;
        for (let i = 0; i < l; i += 1) {
            activeEls[i].classList.remove('tap-active');
        }
    }
}

const isInputOrLink = function (node) {
    const nodeName = node.nodeName;
    let seenLink = false;
    if (
        nodeName === 'INPUT' ||
        nodeName === 'BUTTON' ||
        nodeName === 'TEXTAREA' ||
        nodeName === 'SELECT'
    ) {
        return true;
    }
    while (node && node.contentEditable === 'inherit') {
        if (node.nodeName === 'A') {
            seenLink = true;
        }
        node = node.parentNode;
    }
    if (node && node.contentEditable === 'true') {
        return true;
    }
    while (!seenLink && node) {
        if (node.nodeName === 'A') {
            seenLink = true;
        }
        node = node.parentNode;
    }
    return seenLink;
};

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
const Tap = new Gesture({
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
                tracking[id] = new TrackedTouch(
                    touch.clientX,
                    touch.clientY,
                    touch.target,
                );
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

    end(event) {
        const touches = event.changedTouches;
        const tracking = this._tracking;
        const l = touches.length;
        for (let i = 0; i < l; i += 1) {
            const touch = touches[i];
            const id = touch.identifier;
            const trackedTouch = tracking[id];
            if (trackedTouch) {
                let target = document.elementFromPoint(
                    touch.clientX,
                    touch.clientY,
                );
                const initialTarget = trackedTouch.target;
                const duration = Date.now() - trackedTouch.timestamp;
                if (target !== initialTarget) {
                    target = getCommonAncestor(target, initialTarget);
                }
                if (target) {
                    const tapEvent = new TapEvent('tap', target, {
                        duration,
                    });
                    ViewEventsController.handleEvent(tapEvent);
                    const clickEvent = new TapEvent('click', target);
                    clickEvent.defaultPrevented = tapEvent.defaultPrevented;
                    ViewEventsController.handleEvent(clickEvent);
                    // The tap could trigger a UI change. When the click event
                    // is fired 300ms later, if there is now an input under the
                    // area the touch took place, in iOS the keyboard will
                    // appear, even though the preventDefault on the click event
                    // stops it actually being focused. Calling preventDefault
                    // on the touchend event stops this happening, however we
                    // must not do this if the user actually taps an input or
                    // a link!
                    if (!isInputOrLink(target)) {
                        event.preventDefault();
                    }
                    new MouseEventRemover(target, clickEvent.defaultPrevented);
                }
                trackedTouch.done();
                delete tracking[id];
            }
        }
    },
});

export { Tap };
