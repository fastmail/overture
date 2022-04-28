import { Class } from '../../core/Core.js';
import { invokeInNextEventLoop } from '../../foundation/RunLoop.js';
import { ScrollView } from '../containers/ScrollView.js';
import { ListView } from './ListView.js';
import { TrueVisibleRect } from './TrueVisibleRect.js';

/* { observes, queue } from */
import '../../foundation/Decorators.js';

const ProgressiveListView = Class({
    Name: 'ProgressiveListView',

    Extends: ListView,

    Mixin: TrueVisibleRect,

    batchSize: 10,
    numItemsPastVisible: function () {
        return Math.ceil(200 / this.get('itemHeight'));
    }.property('itemHeight'),

    init: function (/* ...mixins */) {
        ProgressiveListView.parent.constructor.apply(this, arguments);
        this.firstVisible = 0;
        this.lastVisible = 0;
        this._renderRange.end = 0;
    },

    contentWasUpdated(event) {
        const scrollView = this.getParent(ScrollView);
        if (scrollView) {
            // Update scroll view correctly.
            const itemHeight = this.get('itemHeight');
            const y = Math.max(this.get('visibleRect').y, 0);
            // Index of first item rendered
            let top = ~~(y / itemHeight);
            const removedIndexes = event.removedIndexes;
            const addedIndexes = event.addedIndexes;
            const rendered = this._rendered;
            let change = 0;

            // If we are within 3 items of the top, don't change anything.
            // The new items will push down the old so you will see the change.
            // Otherwise, adjust the scroll to make it appear as though it
            // hasn't changed when the new items are inserted above, so a flood
            // of items doesn't stop you from viewing a section of the list.
            if (top > 2) {
                for (let i = 0, l = removedIndexes.length; i < l; i += 1) {
                    if (removedIndexes[i] < top) {
                        change -= 1;
                    } else {
                        // Guaranteed in ascending order.
                        break;
                    }
                }
                top += change;
                for (let i = 0, l = addedIndexes.length; i < l; i += 1) {
                    if (addedIndexes[i] <= top) {
                        change += 1;
                    } else {
                        // Guaranteed in ascending order.
                        break;
                    }
                }
            }
            if (change) {
                for (const id in rendered) {
                    const view = rendered[id];
                    view.set('animateLayer', false)
                        .set('index', view.get('index') + change)
                        .redraw()
                        .set('animateLayer', true);
                }
                scrollView.scrollBy(0, change * itemHeight);
                scrollView.redraw();
            }
        }
        return ProgressiveListView.parent.contentWasUpdated.call(this, event);
    },

    _simulateScroll: function (_, __, oldLength, length) {
        if (!this.get('isInDocument')) {
            return;
        }
        // Convert null/undefined length to 0.
        if (!length) {
            length = 0;
        }
        // In IE or Opera, if the scrollTop of the containing overflowed div was
        // past the new maximum scrollTop, then although it correctly changes
        // to the new maximum scrollTop, no scroll event is fired. Therefore we
        // have to simulate this firing in the next event loop.
        if (length < oldLength) {
            invokeInNextEventLoop(this.fire.bind(this, 'scroll', null, null));
        }
    }.observes('contentLength'),

    visibleRectDidChange: function () {
        // We only care about changes when we're visible.
        if (this.get('isInDocument')) {
            const visible = this.get('visibleRect');
            const extension = this.get('numItemsPastVisible');
            const batchSize = this.get('batchSize');
            const y = visible.y;
            const height = visible.height;
            const firstVisible = this.offsetToIndex(y);
            const lastVisible = this.offsetToIndex(y + height);
            // Index (inclusive) of first item we want rendered
            const start = Math.max(
                0,
                Math.floor((firstVisible - extension) / batchSize) * batchSize,
            );
            // Index (exclusive) of last item we want rendered
            const end =
                (Math.floor((lastVisible + extension) / batchSize) + 1) *
                batchSize;
            const _renderRange = this._renderRange;

            this.set('firstVisible', firstVisible).set(
                'lastVisible',
                lastVisible + 1, // End index is exclusive
            );

            if (start !== _renderRange.start || end !== _renderRange.end) {
                _renderRange.start = start;
                _renderRange.end = end;
                this.viewNeedsRedraw();
            }
        }
    }
        .queue('middle')
        .observes('visibleRect', 'itemLayout'),
});

export { ProgressiveListView };
