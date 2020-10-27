import { Animation } from '../../animation/Animation.js';
import { ease, linear } from '../../animation/Easing.js';
import { Class, mixin } from '../../core/Core.js';
import { create as el, setStyle } from '../../dom/Element.js';
import { EventTarget } from '../../foundation/EventTarget.js';
import { tap } from '../../touch/tap.js';
import { LAYOUT_FILL_PARENT, View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';
import { ScrollView } from './ScrollView.js';

import /* { on, property } from */ '../../foundation/Decorators.js';

// ---

const ScrollViewPrototype = ScrollView.prototype;

const getTouch = function (touches, id) {
    for (let i = 0, l = touches.length; i < l; i += 1) {
        if (touches[i].identifier === id) {
            return touches[i];
        }
    }
    return null;
};

class TouchScrollAnimator extends Animation {
    constructor(mixin) {
        super();
        this._initialTouchX = 0;
        this._initialTouchY = 0;
        this._initialTouchTime = 0;

        this._lastTouchX = 0;
        this._lastTouchY = 0;
        this._lastTouchTime = 0;

        this._enableScrollX = false;
        this._enableScrollY = false;

        this._trackingId = null;
        this._isDragging = false;

        this._positions = [];
        this._times = [];

        this._snapX = null;
        this._snapY = null;

        this._velocityX = 0;
        this._velocityY = 0;
        this._lastFrameTime = 0;

        this.isDecelerating = false;

        this.startX = 0;
        this.startY = 0;

        this.endX = 0;
        this.endY = 0;

        this.mayScrollX = false;
        this.mayScrollY = true;

        this.currentX = 0;
        this.currentY = 0;

        this.maxX = 0;
        this.maxY = 0;

        this.speed = 1;

        Object.assign(this, mixin);
    }

    prepare(coordinates) {
        this.syncDimensions();
        if (!coordinates) {
            this.isDecelerating = true;
            return true;
        }
        this.isDecelerating = false;

        const startX = (this.startX = this.currentX);
        const startY = (this.startY = this.currentY);
        const endX = (this.endX = coordinates.x || 0);
        const endY = (this.endY = coordinates.y || 0);
        const deltaX = (this.deltaX = endX - startX);
        const deltaY = (this.deltaY = endY - startY);

        return !!(deltaX || deltaY);
    }

    drawFrame(position, time) {
        if (this.isDecelerating) {
            if (!this.drawDecelerationFrame(time)) {
                this.stop();
            }
        } else {
            let x =
                position !== 1
                    ? this.startX + position * this.deltaX
                    : this.endX;
            let y =
                position !== 1
                    ? this.startY + position * this.deltaY
                    : this.endY;
            x = Math.round(x);
            y = Math.round(y);
            this.currentX = x;
            this.currentY = y;
            this.object.setXY(x, y, false);
        }
        return this;
    }

    shouldStartScroll(x, y) {
        const moveX = Math.abs(x - this._initialTouchX);
        const moveY = Math.abs(y - this._initialTouchY);
        let isDragging = false;

        if (moveX >= 5 || moveY >= 5) {
            isDragging = this._enableScrollX = this.mayScrollX && moveX >= 3;
            isDragging =
                (this._enableScrollY = this.mayScrollY && moveY >= 3) ||
                isDragging;
        }
        return isDragging;
    }

    getSnapPoint(/* x, y */) {
        return null;
    }

    drawDecelerationFrame(time) {
        const FRICTION = 0.965;
        const PENETRATION_DECELERATION = 0.08;
        const PENETRATION_ACCELERATION = 0.15;

        const deltaTime = time - (this._lastFrameTime || time);
        const friction = Math.pow(FRICTION, deltaTime / (1000 / 60));
        let currentX = this.currentX;
        let currentY = this.currentY;
        let velocityX = this._velocityX;
        let velocityY = this._velocityY;
        let scrollOutsideX = 0;
        let scrollOutsideY = 0;

        currentX += velocityX;
        currentY += velocityY;

        velocityX *= friction;
        velocityY *= friction;

        if (!this.object.isInfinite) {
            const maxX = this.maxX;
            const maxY = this.maxY;
            if (!this.object.allowBounce) {
                if (currentX < 0) {
                    currentX = 0;
                    velocityX = 0;
                }
                if (currentX > maxX) {
                    currentX = maxX;
                    velocityX = 0;
                }
                if (currentY < 0) {
                    currentY = 0;
                    velocityY = 0;
                }
                if (currentY > maxY) {
                    currentY = maxY;
                    velocityY = 0;
                }
            } else {
                const snapX = this._snapX;
                if (snapX !== null) {
                    scrollOutsideX = snapX - currentX;
                } else if (currentX < 0) {
                    scrollOutsideX = -currentX;
                } else if (currentX > maxX) {
                    scrollOutsideX = maxX - currentX;
                }
                const snapY = this._snapY;
                if (snapY !== null) {
                    scrollOutsideY = snapY - currentY;
                } else if (currentY < 0) {
                    scrollOutsideY = -currentY;
                } else if (currentY > maxY) {
                    scrollOutsideY = maxY - currentY;
                }
                if (scrollOutsideX < -0.01 || 0.01 < scrollOutsideX) {
                    if (scrollOutsideX * velocityX <= 0) {
                        velocityX += scrollOutsideX * PENETRATION_DECELERATION;
                    } else {
                        velocityX = scrollOutsideX * PENETRATION_ACCELERATION;
                    }
                } else {
                    currentX = Math.round(currentX + scrollOutsideX);
                    scrollOutsideX = 0;
                }
                if (scrollOutsideY < -0.01 || 0.01 < scrollOutsideY) {
                    if (scrollOutsideY * velocityY <= 0) {
                        velocityY += scrollOutsideY * PENETRATION_DECELERATION;
                    } else {
                        velocityY = scrollOutsideY * PENETRATION_ACCELERATION;
                    }
                } else {
                    currentY = Math.round(currentY + scrollOutsideY);
                    scrollOutsideY = 0;
                }
            }
        }

        this.currentX = currentX;
        this.currentY = currentY;
        if (time) {
            this.object.setXY(currentX, currentY, false);
            this._lastFrameTime = time;
        }

        this._velocityX = velocityX;
        this._velocityY = velocityY;

        return (
            !!(scrollOutsideX || scrollOutsideY) ||
            Math.abs(velocityX) >= 0.1 ||
            Math.abs(velocityY) >= 0.1
        );
    }
}

mixin(TouchScrollAnimator.prototype, EventTarget);
mixin(TouchScrollAnimator.prototype, {
    onTouchStart: function (event) {
        const touches = event.touches;
        const touch = touches[0];
        const currentTouchX = touch.clientX;
        const currentTouchY = touch.clientY;
        const currentTouchTime = event.timeStamp || Date.now();

        if (touches.length > 1) {
            return;
        }

        // Cancel any currently running animation
        if (this.isRunning) {
            this.stop();
            // Prevent click event from occurring
            if (!this.object.get('allowDefaultTouch')) {
                event.preventDefault();
            }
            tap.cancel();
        }

        // Store initial positions and time
        this._initialTouchX = currentTouchX;
        this._initialTouchY = currentTouchY;
        this._initialTouchTime = currentTouchTime;

        // Store initial touch positions and time
        this._lastTouchX = currentTouchX;
        this._lastTouchY = currentTouchY;
        this._lastTouchTime = currentTouchTime;

        // Reset locking flags
        this._enableScrollX = false;
        this._enableScrollY = false;

        // Note the touch we're tracking
        this._trackingId = touch.identifier;
        this._isDragging = false;

        // And get the dimensions we're constrained in
        this.syncDimensions();
    }.on('touchstart'),

    onTouchMove: function (event) {
        const object = this.object;
        const timeStamp = event.timeStamp || Date.now();
        const touch = getTouch(event.changedTouches, this._trackingId);

        if (!touch) {
            return;
        }

        const currentTouchX = touch.clientX;
        const currentTouchY = touch.clientY;

        if (!object.get('allowDefaultTouch')) {
            event.preventDefault();
        }

        if (this._isDragging) {
            const isInfinite = object.isInfinite;
            const allowBounce = object.allowBounce;
            let currentX = this.currentX;
            let currentY = this.currentY;
            if (this._enableScrollX) {
                let moveX = currentTouchX - this._lastTouchX;
                moveX *= this.speed;
                currentX -= moveX;
                if (!isInfinite) {
                    const maxX = this.maxX;
                    if (currentX > maxX || currentX < 0) {
                        // Slow down on the edges
                        if (allowBounce) {
                            currentX += moveX >> 1;
                        } else if (currentX > maxX) {
                            currentX = maxX;
                        } else {
                            currentX = 0;
                        }
                    }
                }
            }

            // Compute new vertical scroll position
            if (this._enableScrollY) {
                let moveY = currentTouchY - this._lastTouchY;
                moveY *= this.speed;
                currentY -= moveY;
                if (!isInfinite) {
                    const maxY = this.maxY;
                    if (currentY > maxY || currentY < 0) {
                        // Slow down on the edges
                        if (allowBounce) {
                            currentY += moveY >> 1;
                        } else if (currentY > maxY) {
                            currentY = maxY;
                        } else {
                            currentY = 0;
                        }
                    }
                }
            }

            // Set scroll position
            this.currentX = currentX;
            this.currentY = currentY;
            object.setXY(currentX, currentY, true);
            this._positions.push(currentTouchX, currentTouchY);
            this._times.push(timeStamp);
        }
        // Otherwise figure out whether we are switching into dragging mode now.
        else if (this.shouldStartScroll(currentTouchX, currentTouchY)) {
            this._isDragging = true;
            tap.cancel();
            ViewEventsController.addEventTarget(this, 100);
        }

        // Update last touch positions and time stamp for next event
        this._lastTouchX = currentTouchX;
        this._lastTouchY = currentTouchY;
        this._lastTouchTime = timeStamp;
    }.on('touchmove'),

    onTouchEnd: function (event) {
        // Only care if it's our tracked touch that ends
        if (!getTouch(event.changedTouches, this._trackingId)) {
            return;
        }
        this._trackingId = null;
        if (this._isDragging) {
            const timeStamp = this._lastTouchTime;
            const times = this._times;
            const positions = this._positions;
            const positionsLength = positions.length;
            const index = times.binarySearch(timeStamp - 100);
            const timeDelta = timeStamp - times[index];
            // px per 1/60s
            const velocityX =
                timeDelta && this.mayScrollX
                    ? (-(
                          positions[positionsLength - 2] - positions[index * 2]
                      ) /
                          timeDelta) *
                      (1000 / 60)
                    : 0;
            let velocityY =
                timeDelta && this.mayScrollY
                    ? (-(
                          positions[positionsLength - 1] -
                          positions[index * 2 + 1]
                      ) /
                          timeDelta) *
                      (1000 / 60)
                    : 0;
            const snap = this.getSnapPoint(this.currentX, this.currentY);

            this._snapX = snap ? snap.x : null;
            this._snapY = snap ? snap.y : null;

            // Increase momentum on flicks
            // 1. Was moving in same direction as flick
            // 2. Flick has velocity > 30
            // 3. Flick took less than 100ms
            if (
                velocityY * this._velocityY > 0 &&
                Math.abs(velocityY) > 30 &&
                timeStamp - this._initialTouchTime < 100
            ) {
                velocityY += this._velocityY;
            }

            this._isDragging = false;

            // Start deceleration if moving greater than ~1px per frame at 60FPS
            // or if allow bounce (will check if outside bounds and animate
            // back)
            if (
                this.object.allowBounce ||
                snap ||
                Math.abs(velocityX) > 1 ||
                Math.abs(velocityY) > 1
            ) {
                this._velocityX = velocityX;
                this._velocityY = velocityY;
                this._lastFrameTime = 0;
                this.animate(null, 60000, linear);
            }
            times.length = 0;
            positions.length = 0;
            ViewEventsController.removeEventTarget(this);
        }
    }.on('touchend', 'touchcancel'),
});

const TouchScrollView = Class({
    Name: 'TouchScrollView',

    Extends: View,

    keys: {},

    showScrollbarX: false,
    showScrollbarY: true,

    init: function (mixin) {
        this.allowDefaultTouch = false;

        this.isInfinite = false;
        this.allowBounce = false;

        this.scrollLeft = 0;
        this.scrollTop = 0;

        TouchScrollView.parent.constructor.call(this, mixin);
    },

    willEnterDocument: ScrollViewPrototype.willEnterDocument,

    didEnterDocument() {
        // Add keyboard shortcuts:
        const keys = this.get('keys');
        const shortcuts = ViewEventsController.kbShortcuts;
        for (const key in keys) {
            shortcuts.register(key, this, keys[key]);
        }

        return TouchScrollView.parent.didEnterDocument.call(this);
    },

    willLeaveDocument() {
        // Remove keyboard shortcuts:
        const keys = this.get('keys');
        const shortcuts = ViewEventsController.kbShortcuts;
        for (const key in keys) {
            shortcuts.deregister(key, this, keys[key]);
        }

        return TouchScrollView.parent.willLeaveDocument.call(this);
    },

    didLeaveDocument: ScrollViewPrototype.didLeaveDocument,

    positioning: 'absolute',

    layout: LAYOUT_FILL_PARENT,

    layerStyles: function () {
        const styles = View.prototype.layerStyles.call(this);
        styles.overflow = 'hidden';
        return styles;
    }.property('layout', 'positioning'),

    isFixedDimensions: ScrollViewPrototype.isFixedDimensions,

    draw(layer) {
        const scrollContents = el('div.v-TouchScroll-contents', [
            TouchScrollView.parent.draw.call(this, layer),
        ]);
        this._scrollContents = scrollContents;
        this.redrawScroll();
        return [scrollContents];
    },

    insertView(view, relativeTo, where) {
        if (
            !relativeTo &&
            this.get('isRendered') &&
            where !== 'before' &&
            where !== 'after'
        ) {
            relativeTo = this.get('layer').firstChild;
        }
        return TouchScrollView.parent.insertView.call(
            this,
            view,
            relativeTo,
            where,
        );
    },

    redrawSafeArea() {
        ScrollViewPrototype.redrawSafeArea.call(this);
        this.computedPropertyDidChange('scrollHeight');
    },

    scrollPage: ScrollViewPrototype.scrollPage,
    reverseScrollPage: ScrollViewPrototype.reverseScrollPage,
    scrollLine: ScrollViewPrototype.scrollLine,
    reverseScrollLine: ScrollViewPrototype.reverseScrollLine,
    scrollBy: ScrollViewPrototype.scrollBy,
    scrollToView: ScrollViewPrototype.scrollToView,

    scrollAnimation: function () {
        return new TouchScrollAnimator({
            object: this,
            mayScrollX: this.get('showScrollbarX'),
            mayScrollY: this.get('showScrollbarY'),
            syncDimensions() {
                const view = this.object;
                this.currentX = view.get('scrollLeft');
                this.currentY = view.get('scrollTop');
                this.maxX = view.get('maxScrollX');
                this.maxY = view.get('maxScrollY');
            },
        });
    }.property(),

    scrollWidth: function (scrollWidth) {
        if (scrollWidth !== undefined) {
            return scrollWidth;
        }
        return this.get('layer').scrollWidth;
    }.property('isInDocument'),

    scrollHeight: function (scrollHeight) {
        if (scrollHeight === undefined) {
            scrollHeight = this.get('layer').scrollHeight;
        }
        return scrollHeight;
    }.property('isInDocument'),

    maxScrollX: function () {
        return this.get('showScrollbarX')
            ? Math.max(0, this.get('scrollWidth') - this.get('pxWidth'))
            : 0;
    }.property('scrollWidth', 'pxWidth'),

    maxScrollY: function () {
        return this.get('showScrollbarY')
            ? Math.max(0, this.get('scrollHeight') - this.get('pxHeight'))
            : 0;
    }.property('scrollHeight', 'pxHeight'),

    scrollTo(x, y, withAnimation) {
        // Clamp value to allowed bounds
        if (!this.isInfinite) {
            if (x) {
                x = Math.min(x, this.get('maxScrollX'));
                if (x < 0) {
                    x = 0;
                }
            }
            if (y) {
                y = Math.min(y, this.get('maxScrollY'));
                if (y < 0) {
                    y = 0;
                }
            }
        }

        if (x !== this.get('scrollLeft') || y !== this.get('scrollTop')) {
            // Cancel or override any running scroll animation
            const scrollAnimation = this.get('scrollAnimation').stop();
            if (withAnimation) {
                scrollAnimation.animate({ x, y }, 250, ease);
            } else {
                this.beginPropertyChanges()
                    .set('scrollLeft', x)
                    .set('scrollTop', y)
                    .endPropertyChanges()
                    .propertyNeedsRedraw(this, 'scroll');
            }
        }

        return this;
    },

    // Fast path for touch/animator only
    setXY(x, y, queue) {
        this.set('scrollLeft', x).set('scrollTop', y);
        if (queue) {
            this.propertyNeedsRedraw(this, 'scroll');
        } else {
            this.redrawScroll();
        }
    },

    redrawScroll() {
        const x = this.get('scrollLeft');
        const y = this.get('scrollTop');
        setStyle(
            this._scrollContents,
            'transform',
            'translate3d(' + -x + 'px,' + -y + 'px,0)',
        );
    },

    proxyTouchEvents: function (event) {
        this.get('scrollAnimation').fire(event.type, event);
    }.on('touchstart', 'touchmove', 'touchend', 'touchcancel'),
});

// ---

export { TouchScrollAnimator, TouchScrollView };
