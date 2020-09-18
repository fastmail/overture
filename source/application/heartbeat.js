import /* { observes } from */ '../foundation/Decorators.js';
import { invokeAfterDelay, cancel } from '../foundation/RunLoop.js';

/**
    Object: heartbeat

    Calls the `nowNeedsRedraw` method on the minute, every minute. Mainly used
    implicitly via the RedrawOnMinute mixin to a view class to redraw every
    minute (e.g. to update a relative time).
*/
const heartbeat = {
    _views: [],
    _timer: null,
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
        this._timer = invokeAfterDelay(
            this.beat,
            61000 - 1000 * new Date().getUTCSeconds(),
            this,
        );
    },
    stop() {
        if (this._timer) {
            cancel(this._timer);
            this._timer = null;
        }
    },
    beat() {
        this._views.forEach((view) => {
            view.nowNeedsRedraw();
        });
        this.start();
    },
};

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
