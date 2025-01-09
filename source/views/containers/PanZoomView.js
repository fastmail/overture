import { Animation } from '../../animation/Animation.js';
import { linear } from '../../animation/Easing.js';
import { Class } from '../../core/Core.js';
import { limit } from '../../core/Math.js';
import {
    appendChildren,
    getRawBoundingClientRect,
    setStyle,
} from '../../dom/Element.js';
import { ViewEventsController } from '../ViewEventsController.js';
import { ScrollView } from './ScrollView.js';
import { TouchScrollView } from './TouchScrollView.js';

import /* {
    nextFrame,
    nextLoop,
    observes,
    on,
    property,
    queue,
} from */ '../../foundation/Decorators.js';

const PanZoomView = Class({
    Name: 'PanZoomView',

    Extends: TouchScrollView,

    showScrollbarX: true,
    showScrollbarY: false,

    init: function (mixin) {
        PanZoomView.parent.init.call(this, mixin);

        this.scaleAnimation = new Animation({
            object: this,
            property: 'scale',
            duration: 200,
        });

        this.scale = 1;

        this._tCount = 0;
        this._tScale = 1;
        this._tDist = 0;
        this._tX = 0;
        this._tY = 0;
        this._posX = 0;
        this._posY = 0;
        this._scrollParent = null;
    },

    setListeners: function () {
        const layer = this.get('layer');
        if (this.get('isInDocument')) {
            layer.addEventListener('load', this, true);
            layer.addEventListener('transitionend', this, true);
            this.contentDidResize();
        } else {
            layer.removeEventListener('load', this, true);
            layer.removeEventListener('transitionend', this, true);
        }
    }.observes('isInDocument'),

    parentViewDidResize() {
        if (this.get('isInDocument')) {
            this.contentDidResize();
        }
        return PanZoomView.parent.parentViewDidResize.call(this);
    },

    // Needs to be in the next next frame after the next event loop so the
    // browser has definitely drawn the loaded image and we get the proper
    // resized dimensions. Why, I'm not quite sure but just nextLoop no longer
    // seems to be enough.
    contentDidResize: function () {
        this.computedPropertyDidChange('scrollWidth').computedPropertyDidChange(
            'scrollHeight',
        );
        const minScale = this.get('minScale');
        if (this.get('scale') < minScale) {
            this.set('scale', minScale);
        }
        const scrollLeft = this.get('scrollLeft');
        const scrollTop = this.get('scrollTop');
        if (
            scrollLeft > this.get('maxScrollX') ||
            scrollTop > this.get('maxScrollY')
        ) {
            // This will clamp them to allowed values
            this.scrollTo(scrollLeft, scrollTop, false);
        }
    }
        .nextLoop()
        .nextFrame()
        .on('load', 'transitionend'),

    positioning: 'relative',

    layout: function () {
        const scale = this.get('scale');
        return {
            height:
                this.get('isInDocument') && scale !== 1
                    ? this.get('scrollHeight') * scale
                    : 'auto',
        };
    }.property('scrollHeight', 'scale'),

    scrollWidth: function () {
        return this._scrollContents.scrollWidth;
    }.property('isInDocument'),

    scrollHeight: function () {
        return this._scrollContents.scrollHeight;
    }.property('isInDocument'),

    _setAllowBounce: function () {
        this.allowBounce =
            !!this.get('maxScrollX') ||
            this.get('scale') < this.get('minScale');
    }.on('touchstart'),
    _setAllowBounce2: function () {
        this.allowBounce = true;
    }.observes('scale'),

    maxScrollX: function () {
        const scale = this.get('scale');
        const pxWidth = this.get('pxWidth');
        const scrollWidth = this.get('scrollWidth');
        return this.get('showScrollbarX')
            ? Math.max(0, scale * scrollWidth - pxWidth)
            : 0;
    }.property('scale', 'scrollWidth', 'pxWidth'),

    maxScrollY: function () {
        const scale = this.get('scale');
        const pxHeight = this.get('pxHeight');
        const scrollHeight = this.get('scrollHeight');
        return this.get('showScrollbarY')
            ? Math.max(0, scale * scrollHeight - pxHeight)
            : 0;
    }.property('scale', 'scrollHeight', 'pxHeight'),

    minScale: function () {
        return this.get('isInDocument')
            ? limit(this.get('pxWidth') / this.get('scrollWidth'), 0.25, 1)
            : 1;
    }.property('pxWidth', 'scrollWidth'),

    maxScale: 3,

    setInitialScale: function () {
        this.set('scale', this.get('minScale'));
    }
        .queue('after')
        .observes('isInDocument'),

    // Draw scale

    draw(layer) {
        const render = PanZoomView.parent.draw.call(this, layer);
        const scrollContents = render[0];
        appendChildren(scrollContents, this.contents);
        setStyle(scrollContents, '-webkit-transform-origin', '0 0');
        setStyle(scrollContents, 'transform-origin', '0 0');
        return render;
    },

    zoomNeedsRedraw: function () {
        this.propertyNeedsRedraw(this, 'scroll');
    }.observes('scale'),

    redrawScroll() {
        const x = this.get('scrollLeft');
        const y = this.get('scrollTop');
        const scale = this.get('scale');
        setStyle(
            this._scrollContents,
            'transform',
            'translate3d(' +
                -x +
                'px,' +
                -y +
                'px,0)' +
                'scale(' +
                scale +
                ') ',
        );
    },

    // Zoom with pinch

    countTouches: function (event) {
        const touches = event.touches;
        const oldTouchCount = this._tCount;
        const newTouchCount = (this._tCount = touches.length);
        const scrollAnimation = this.get('scrollAnimation');
        if (oldTouchCount !== 2 && newTouchCount === 2) {
            this.scaleAnimation.stop();

            // Take over from scroll handlers.
            scrollAnimation._trackingId = null;
            scrollAnimation._isDragging = false;
            scrollAnimation._positions.length = 0;
            scrollAnimation._times.length = 0;
            ViewEventsController.removeEventTarget(scrollAnimation);

            const touchA = touches[0];
            const touchB = touches[1];
            const aX = touchA.screenX;
            const aY = touchA.screenY;
            const bX = touchB.screenX;
            const bY = touchB.screenY;

            const scale = this.get('scale');

            // Distance between touches
            let x = aX - bX;
            let y = aY - bY;

            this._tScale = scale;
            this._tDist = Math.sqrt(x * x + y * y);

            // Find position of centre point between touches
            x = (aX + bX) / 2;
            y = (aY + bY) / 2;

            // Adjust so that it is offset from the top left of the content
            // area as ( 0, 0 ) instead of the screen.
            const position = getRawBoundingClientRect(this.get('layer'));
            let posX = position.left;
            let posY = position.top;
            x -= posX;
            y -= posY;

            const scrollParent =
                this.get('positioning') === 'relative'
                    ? this.getParent(ScrollView)
                    : null;
            if (scrollParent) {
                posX += scrollParent.get('scrollLeft');
                posY += scrollParent.get('scrollTop');
            }

            x += this.get('scrollLeft');
            y += this.get('scrollTop');

            // Now apply the current scale factor to get the coordinates as if
            // scale === 1.
            x /= scale;
            y /= scale;

            this._tX = x;
            this._tY = y;
            this._posX = posX;
            this._posY = posY;
            this._scrollParent = scrollParent;
        } else if (oldTouchCount === 2 && newTouchCount !== 2) {
            this._scrollParent = null;

            // Either continue scrolling, or animate back to min/max bounds.
            if (newTouchCount === 1) {
                scrollAnimation.onTouchStart(event);
                scrollAnimation._isDragging = true;
                scrollAnimation._enableScrollX = true;
            } else {
                scrollAnimation._velocityX = 0;
                scrollAnimation._velocityY = 0;
                scrollAnimation._lastFrameTime = 0;
                scrollAnimation.animate(null, 60000, linear);
            }

            // Animate back to allowed scale.
            this.scaleAnimation.animate(
                limit(
                    this.get('scale'),
                    this.get('minScale'),
                    this.get('maxScale'),
                ),
            );
        }
    }.on('touchstart', 'touchend'),

    zoom: function (event) {
        // It seems some platforms (iOS 9, Firefox Mobile) fire a touchmove
        // event without a corresponding touchstart/end event (or at least,
        // it's out of order). So must double check here to make sure we
        // actually have the number of touches we think we do.
        this.countTouches(event);

        if (this._tCount === 2) {
            // We are handling this; don't scroll parent view.
            event.preventDefault();
            event.stopPropagation();

            const touches = event.touches;
            const touchA = touches[0];
            const touchB = touches[1];
            const aX = touchA.screenX;
            const aY = touchA.screenY;
            const bX = touchB.screenX;
            const bY = touchB.screenY;
            const scrollParent = this._scrollParent;

            // Calculate new scale from distance between touches
            let x = aX - bX;
            let y = aY - bY;
            const distance = Math.sqrt(x * x + y * y);

            const minScale = this.get('minScale');
            const maxScale = this.get('maxScale');
            let scale = (distance / this._tDist) * this._tScale;
            scale =
                scale < minScale / 2
                    ? minScale / 2
                    : scale > maxScale
                      ? maxScale
                      : scale;

            // Find position of current centre point between touches
            x = (aX + bX) / 2;
            y = (aY + bY) / 2;

            // Find where on the screen the original centre point is
            let origX = this._tX * scale - this.get('scrollLeft') + this._posX;
            let origY = this._tY * scale - this.get('scrollTop') + this._posY;

            if (scrollParent) {
                origX -= scrollParent.get('scrollLeft');
                origY -= scrollParent.get('scrollTop');
            }

            // Work out how far we have to scroll to make the part of the doc
            // originally in the centre, still in the centre
            const deltaX = origX - x;
            const deltaY = origY - y;

            if (deltaX) {
                if (
                    scrollParent &&
                    scale >= minScale &&
                    scrollParent.get('showScrollbarX')
                ) {
                    scrollParent.scrollBy(deltaX, 0);
                } else {
                    this.increment('scrollLeft', deltaX);
                }
            }
            if (deltaY) {
                if (
                    scrollParent &&
                    scale >= minScale &&
                    scrollParent.get('showScrollbarY')
                ) {
                    scrollParent.scrollBy(0, deltaY);
                } else {
                    this.increment('scrollTop', deltaY);
                }
            }
            this.set('scale', scale);
        }
    }.on('touchmove'),
});

export { PanZoomView };
