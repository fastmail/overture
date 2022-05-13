/*global document */

import { linear } from '../animation/Easing.js';
import { cancel, invokeAfterDelay } from '../foundation/RunLoop.js';
import { getViewFromNode } from '../views/activeViews.js';
import { ScrollView } from '../views/containers/ScrollView.js';
import { CheckboxView } from '../views/controls/CheckboxView.js';
import { RootView } from '../views/RootView.js';
import { ViewEventsController } from '../views/ViewEventsController.js';

const IDLE = 0;
const DETECT = 1;
const SELECT = 2;

const WAITING = 1;
const SCROLLING = 2;
const TOP = 4;
const BOTTOM = 8;
const NONE = 16;

const scrollTriggerPx = 60;

const getXY = function (event) {
    const touches = Array.from(event.touches);
    const numTouches = touches.length;
    return {
        x: touches.reduce((acc, t) => acc + t.clientX, 0) / numTouches,
        y: touches.reduce((acc, t) => acc + t.clientY, 0) / numTouches,
    };
};

/*
    Usage: call `itemListTouchSelect.go( event, this )` in the touchstart
    handler on a ListItemView.
*/

const itemListTouchSelect = {
    state: IDLE,
    xy: null,

    itemView: null,
    selection: null,
    index: 0,
    lastIndex: 0,
    wasSelected: null,
    isSelected: false,

    scrollView: null,
    scrollState: IDLE,
    scrollTimeout: null,
    scrollTop: 0,
    scrollBottom: 0,

    // ---

    go(event, view) {
        if (this.state !== IDLE) {
            if (this.itemView === view) {
                return;
            }
            this.goIdle();
        }
        this.touchstart(event, view);
    },

    goIdle() {
        this.state = IDLE;
        this.xy = null;
        this.itemView = null;
        this.selection = null;
        this.wasSelected = null;

        if (this.scrollTimeout) {
            cancel(this.scrollTimeout);
        }
        if (this.scrollState & SCROLLING) {
            this.stopScroll();
        }
        this.scrollView = null;
        this.scrollState = IDLE;
        this.scrollTimeout = null;
        ViewEventsController.removeEventTarget(this);
    },

    goDetect(event, view) {
        this.state = DETECT;
        this.xy = getXY(event);
        this.itemView = view;
        ViewEventsController.addEventTarget(this, 70);
    },

    goSelect(event) {
        const view = this.itemView;
        if (!view.get('isInDocument')) {
            // Ordering of events may trigger this after the user has swiped to
            // archive/delete I think? We're definitely getting occasional
            // crashes here anyway, because the ScrollView has no parent
            // RootView, which must mean this is not in the document.
            return;
        }
        const selection = view.get('selection');
        const isSelected = !view.get('isSelected');
        const index = view.get('index');
        const scrollView = view.getParent(ScrollView);
        const bounds =
            scrollView && scrollView.get('layer').getBoundingClientRect();
        const xy = getXY(event);

        this.state = SELECT;
        this.selection = selection;
        this.index = index;
        this.lastIndex = index;
        this.wasSelected = {};
        this.isSelected = isSelected;
        this.scrollView = scrollView;
        this.scrollTop = bounds ? bounds.top + scrollTriggerPx : 0;
        this.scrollBottom = bounds
            ? bounds.bottom -
              scrollView.getParent(RootView).get('safeAreaInsetBottom') -
              scrollTriggerPx
            : Number.MAX_SAFE_INTEGER;

        selection.selectIndex(this.index, isSelected);
        this.updateSelection(xy);
        this.checkScroll(xy);
    },

    getViewFromXY(xy) {
        const node = document.elementFromPoint(xy.x, xy.y);
        let view = node && getViewFromNode(node);
        const ItemViewClass = this.itemView.constructor;
        while (view && !(view instanceof ItemViewClass)) {
            view = view.get('parentView');
        }
        return view;
    },

    // ---

    getStoreKeysForRange(start, end, callback) {
        const selection = this.selection;
        const query = selection.get('visible') || selection.get('content');
        query.getStoreKeysForObjectsInRange(
            start,
            Math.min(end, query.get('length') || 0),
            callback,
        );
    },

    restoreSelection(start, end) {
        this.getStoreKeysForRange(start, end, (storeKeys) => {
            if (this.state !== SELECT) {
                return;
            }
            const selection = this.selection;
            const wasSelected = this.wasSelected;
            const toSelect = [];
            const toUnselect = [];
            for (let i = 0, l = storeKeys.length; i < l; i += 1) {
                const storeKey = storeKeys[i];
                if (wasSelected[storeKey]) {
                    toSelect.push(storeKey);
                } else {
                    toUnselect.push(storeKey);
                }
            }
            if (toSelect.length) {
                selection.selectStoreKeys(toSelect, true);
            }
            if (toUnselect.length) {
                selection.selectStoreKeys(toUnselect, false);
            }
        });
    },

    setSelection(start, end) {
        this.getStoreKeysForRange(start, end, (storeKeys) => {
            if (this.state !== SELECT) {
                return;
            }
            const selection = this.selection;
            const isSelected = this.isSelected;
            const wasSelected = this.wasSelected;
            for (let i = 0, l = storeKeys.length; i < l; i += 1) {
                const storeKey = storeKeys[i];
                if (!(storeKey in wasSelected)) {
                    wasSelected[storeKey] =
                        selection.isStoreKeySelected(storeKey);
                }
            }
            selection.selectStoreKeys(storeKeys, isSelected);
        });
    },

    updateSelection(xy) {
        const view = this.getViewFromXY(xy);
        if (!view) {
            return;
        }

        const newIndex = view.get('index');
        const lastIndex = this.lastIndex;
        const index = this.index;
        if (newIndex === lastIndex) {
            // Do nothing
        } else if (newIndex < index) {
            if (lastIndex < newIndex) {
                this.restoreSelection(lastIndex, newIndex);
            } else {
                this.setSelection(newIndex, index);
                if (lastIndex > index) {
                    this.restoreSelection(index + 1, lastIndex + 1);
                }
            }
        } else if (newIndex > index) {
            if (lastIndex > newIndex) {
                this.restoreSelection(newIndex + 1, lastIndex + 1);
            } else {
                this.setSelection(index + 1, newIndex + 1);
                if (lastIndex < index) {
                    this.restoreSelection(lastIndex, index);
                }
            }
        } else if (lastIndex > newIndex) {
            this.restoreSelection(index + 1, lastIndex + 1);
        } else if (lastIndex < newIndex) {
            this.restoreSelection(lastIndex, index);
        }
        this.lastIndex = newIndex;
        this.xy = xy;
    },

    // ---

    checkScroll(xy) {
        const scrollSection =
            xy.y < this.scrollTop
                ? TOP
                : xy.y > this.scrollBottom
                ? BOTTOM
                : NONE;
        let scrollState = this.scrollState;
        if (scrollState & WAITING && !(scrollState & scrollSection)) {
            cancel(this.scrollTimeout);
            this.scrollTimeout = null;
            scrollState = IDLE;
        }
        if (scrollState & SCROLLING && !(scrollState & scrollSection)) {
            this.stopScroll();
            scrollState = IDLE;
        }
        if (scrollState === IDLE && scrollSection !== NONE) {
            this.scrollTimeout = invokeAfterDelay(this.startScroll, 300, this);
            scrollState = WAITING | scrollSection;
        }
        this.scrollState = scrollState;
    },

    startScroll() {
        let scrollState = this.scrollState;
        const scrollView = this.scrollView;
        const scrollAnimation = scrollView.get('scrollAnimation');
        let scrollTop = 0;
        let distance = scrollView.get('scrollTop');
        if (scrollState & BOTTOM) {
            scrollTop =
                scrollView.get('layer').scrollHeight -
                scrollView.get('pxHeight');
            distance = scrollTop - distance;
            scrollState = SCROLLING | BOTTOM;
        } else {
            scrollState = SCROLLING | TOP;
        }
        if (distance) {
            scrollAnimation.animate(
                {
                    x: scrollView.get('scrollLeft'),
                    y: scrollTop,
                },
                distance * 4,
                linear,
            );
            scrollView.addObserverForKey('scrollTop', this, 'didScroll');
        }
        this.scrollState = scrollState;
    },

    didScroll() {
        this.updateSelection(this.xy);
    },

    stopScroll() {
        const scrollView = this.scrollView;
        const scrollAnimation = scrollView.get('scrollAnimation');
        scrollView.removeObserverForKey('scrollTop', this, 'didScroll');
        scrollAnimation.stop();
        delete scrollAnimation.duration;
        delete scrollAnimation.ease;
    },

    // ---

    fire(type, event) {
        if (this[type]) {
            this[type](event, this.itemView);
        }
    },

    touchstart(event, view) {
        const numTouches = event.touches.length;
        switch (this.state) {
            case IDLE:
                if (
                    numTouches === 2 ||
                    (view.get('selection').get('length') &&
                        event.targetView instanceof CheckboxView)
                ) {
                    this.goDetect(event, view);
                }
                break;
            case DETECT:
                if (numTouches > 2) {
                    this.goIdle();
                }
                break;
        }
    },

    touchmove(event) {
        switch (this.state) {
            case DETECT: {
                const xy = getXY(event);
                const x = xy.x - this.xy.x;
                const y = xy.y - this.xy.y;
                if (
                    x * x + y * y >= 100 &&
                    (event.touches.length === 2 ||
                        this.getViewFromXY(xy) !== this.itemView)
                ) {
                    this.goSelect(event);
                }
                event.preventDefault();
                break;
            }
            case SELECT: {
                event.propagationStopped = true;
                const xy = getXY(event);
                this.updateSelection(xy);
                this.checkScroll(xy);
                event.preventDefault();
                break;
            }
        }
    },

    touchend(event) {
        switch (this.state) {
            case DETECT:
                this.goIdle();
                break;
            case SELECT:
                if (!event.touches.length) {
                    this.goIdle();
                }
                break;
        }
    },

    touchcancel() {
        if (this.state !== IDLE) {
            this.goIdle();
        }
    },
};

export { itemListTouchSelect };
