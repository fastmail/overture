import { cancel, invokeAfterDelay } from '../foundation/RunLoop.js';

/* { invokeInRunLoop, observes } from */
import '../foundation/Decorators.js';

/*global document */

/**
    Object: heartbeat

    Calls the `nowNeedsRedraw` method on the minute, every minute. Mainly used
    implicitly via the RedrawOnMinute mixin to a view class to redraw every
    minute (e.g. to update a relative time). Singleton.
*/
const heartbeat = {
    _views: [],
    _timer: null,
    _next: 0,

    /**
        Method: heartbeat#register

        Register a view to be redrawn every minute, on the minute.  It's
        probably more convenient to use the RedrawOnMinute mixin instead!

        Parameters:
            view - {View} The view.
    */
    register(view) {
        const views = this._views;
        if (!views.length) {
            this.start();
        }
        views.push(view);
    },

    /**
        Method: heartbeat#deregister

        Stop redrawing this view every minute.

        Parameters:
            view - {View} The view.
    */
    deregister(view) {
        const views = this._views;
        views.erase(view);
        if (!views.length) {
            this.stop();
        }
    },

    /**
        Method: heartbeat#start

        Starts the heartbeat to redraw all registered views. Invoked by
        heartbeat#register and heartbeat#beat.
    */
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

    /**
        Method: heartbeat#stop

        Stops the heartbeat for all registered views. Invoked by
        heartbeat#deregister.
    */
    stop() {
        if (this._timer) {
            cancel(this._timer);
            this._timer = null;
        }
    },

    /**
        Method: heartbeat#beat

        Called each minute, or when restarting the heartbeat in handleEvent.
        Invokes the view's nowNeedsRedraw method.
    */
    beat() {
        if (Date.now() >= this._next) {
            this._views.forEach((view) => {
                view.nowNeedsRedraw();
            });
        }
        this.start();
    },

    /**
        Method: heartbeat#handleEvent

        Called each minute. Invokes the view's nowNeedsRedraw method.
        Immediately registered as a listener for the document's visibilitychange
        event.
    */
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

/**
 Mixin: RedrawOnMinute

 Used to register a view with the global heartbeat so that the view is redrawn
 every minute, on the minute.
*/
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
