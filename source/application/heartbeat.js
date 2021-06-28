import { cancel, invokeAfterDelay } from '../foundation/RunLoop.js';

import /* { invokeInRunLoop, observes } from */ '../foundation/Decorators.js';

/*global document */

/**
    Object: heartbeat

    Calls the `nowNeedsRedraw` method on the minute, every minute. Mainly used
    implicitly via the RedrawOnMinute mixin to a view class to redraw every
    minute (e.g. to update a relative time).
*/
const heartbeat = {
    _views: [],
    _timer: null,
    _next: 0,
    register(view) {
        const views = this._views;
        if (!views.length) {
            this.start();
        }
        views.push(view);
    },
    deregister(view) {
        const views = this._views;
        views.erase(view);
        if (!views.length) {
            this.stop();
        }
    },
    start() {
        const visibilityState = document.visibilityState || 'visible';
        if (visibilityState !== 'visible') {
            return;
        }
        const now = Date.now();
        const next = now + (60000 - (now % 60000));
        this._next = next;
        this._timer = invokeAfterDelay(this.beat, next - now + 500, this);
    },
    stop() {
        if (this._timer) {
            cancel(this._timer);
            this._timer = null;
        }
    },
    beat() {
        if (Date.now() >= this._next) {
            this._views.forEach((view) => {
                view.nowNeedsRedraw();
            });
        }
        this.start();
    },
    handleEvent: function () {
        const visibilityState = document.visibilityState || 'visible';
        if (visibilityState !== 'visible') {
            this.stop();
        } else {
            if (this._views.length) {
                this.beat();
            }
        }
    }.invokeInRunLoop(),
};
document.addEventListener('visibilitychange', heartbeat, false);

const RedrawOnMinute = {
    register: function () {
        if (this.get('isInDocument')) {
            heartbeat.register(this);
        } else {
            heartbeat.deregister(this);
            // Redraw just before we next enter document.
            this.nowNeedsRedraw();
        }
    }.observes('isInDocument'),
};

export { heartbeat, RedrawOnMinute };
