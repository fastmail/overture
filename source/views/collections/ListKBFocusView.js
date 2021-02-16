import { Class } from '../../core/Core.js';
import { limit } from '../../core/Math.js';
import { bind } from '../../foundation/Binding.js';
import { ScrollView } from '../containers/ScrollView.js';
import { View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';

import /* { property, nocache, queue } from */ '../../foundation/Decorators.js';

const ListKBFocusView = Class({
    Name: 'ListKBFocusView',

    Extends: View,

    listView: null,
    selection: null,
    singleSelection: null,

    index: bind('singleSelection*index'),
    record: bind('singleSelection*record'),

    keys: {
        j: 'goNext',
        k: 'goPrev',
        x: 'select',
        X: 'select',
        o: 'trigger',
        Enter: 'trigger',
        s: 'star',
    },

    className: 'v-ListKBFocus',

    positioning: 'absolute',

    itemLayout: bind('listView*itemLayout'),

    layoutIndex: function () {
        const index = this.get('index');
        const list = this.get('singleSelection').get('content');
        if (
            index > -1 &&
            list &&
            list.getObjectAt(index) !== this.get('record')
        ) {
            return -1;
        }
        return index;
    }.property('index', 'record'),

    layout: function () {
        const index = this.get('layoutIndex');
        const listView = this.get('listView');
        return {
            visibility: index < 0 ? 'hidden' : 'visible',
            marginTop: index < 0 ? 0 : listView.indexToOffset(index),
            height: listView.get('itemHeight'),
        };
    }.property('itemLayout', 'layoutIndex'),

    didEnterDocument() {
        const keys = this.get('keys');
        const shortcuts = ViewEventsController.kbShortcuts;
        for (const key in keys) {
            shortcuts.register(key, this, keys[key]);
        }
        return ListKBFocusView.parent.didEnterDocument.call(this);
    },
    willLeaveDocument() {
        const keys = this.get('keys');
        const shortcuts = ViewEventsController.kbShortcuts;
        for (const key in keys) {
            shortcuts.deregister(key, this, keys[key]);
        }
        return ListKBFocusView.parent.willLeaveDocument.call(this);
    },

    // Scroll to centre widget on screen with no animation
    recordDidChange: function () {
        this._animateIntoView = this.get('isInDocument');
        this.checkScroll();
    }.observes('record'),

    checkScroll: function () {
        const distance = this.get('distanceFromVisRect');
        const animateIntoView = this._animateIntoView;
        if (distance) {
            this.scrollIntoView(
                !animateIntoView ? 0 : distance < 0 ? -0.6 : 0.6,
                animateIntoView,
            );
        }
    }.queue('after'),

    distanceFromVisRect: function () {
        const layoutIndex = this.get('layoutIndex');
        const scrollView = this.getParent(ScrollView);
        if (
            scrollView &&
            layoutIndex > -1 &&
            this.get('isInDocument') &&
            !this._needsRedraw
        ) {
            const scrollTop = scrollView.get('scrollTop');
            const position = this.getPositionRelativeTo(scrollView);
            const top = position.top;
            const above = top - scrollTop;

            if (above < 0) {
                return above;
            }

            const scrollHeight = scrollView.get('pxHeight');
            const below = top + this.get('pxHeight') - scrollTop - scrollHeight;

            if (below > 0) {
                return below;
            }
        }
        return 0;
    }
        .property()
        .nocache(),

    scrollIntoView(offset, withAnimation) {
        const scrollView = this.getParent(ScrollView);
        if (scrollView) {
            const scrollHeight = scrollView.get('pxHeight');
            const pxHeight = this.get('pxHeight');
            const top = this.getPositionRelativeTo(scrollView).top;

            if (offset && -1 <= offset && offset <= 1) {
                offset = (offset * (scrollHeight - pxHeight)) >> 1;
            }
            scrollView.scrollTo(
                0,
                Math.max(
                    0,
                    top + ((pxHeight - scrollHeight) >> 1) + (offset || 0),
                ),
                withAnimation,
            );
        }
    },

    go(delta) {
        const index = this.get('index');
        const singleSelection = this.get('singleSelection');
        const list = singleSelection.get('content');
        const length = (list && list.get('length')) || 0;
        if (
            delta === 1 &&
            index > -1 &&
            list &&
            list.getObjectAt(index) !== this.get('record')
        ) {
            delta = 0;
        }
        if (delta) {
            singleSelection.set('index', limit(index + delta, 0, length - 1));
        } else {
            singleSelection.propertyDidChange('index');
        }
    },
    goNext() {
        this.go(1);
    },
    goPrev() {
        this.go(-1);
    },
    select(event) {
        const index = this.get('index');
        const selection = this.get('selection');
        const record = this.get('record');
        // Check it's next to a loaded record.
        if (selection && record) {
            selection.selectIndex(
                index,
                !selection.isStoreKeySelected(record.get('storeKey')),
                event.shiftKey,
            );
        }
    },
    trigger() {},
    star() {},
});

export { ListKBFocusView };
