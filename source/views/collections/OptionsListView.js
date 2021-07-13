import { Class, guid, isDestroyed } from '../../core/Core.js';
import { DESTROYED } from '../../datastore/record/Status.js';
import { bind } from '../../foundation/Binding.js';
import { ScrollView } from '../containers/ScrollView.js';
import { ListView } from './ListView.js';

const OptionsListView = Class({
    Name: 'OptionsListView',

    Extends: ListView,

    init: function () {
        this._focusedOption = null;
        this._selectedOption = null;
        this._views = {};

        OptionsListView.parent.constructor.apply(this, arguments);
    },

    layerTag: 'ul',

    // ---

    focusedOption: bind('controller*focused'),
    selectedOption: bind('controller*selected'),

    createItemView(item, index, list) {
        const id = guid(item);
        const View = this.getViewTypeForItem(item);
        let view = this._views[id];
        const itemLayout = this.get('itemLayout');
        if (view) {
            view.set('itemLayout', itemLayout)
                .set('index', index)
                .set('list', list)
                .set('parentView', this);
        } else {
            const isFocused = item === this.get('focusedOption');
            const isSelected = item === this.get('selectedOption');
            view = this._views[id] = new View({
                controller: this.get('controller'),
                parentView: this,
                itemLayout,
                content: item,
                index,
                list,
                isFocused,
                isSelected,
            });
            if (isFocused) {
                this._focusedOption = view;
            }
            if (isSelected) {
                this._selectedOption = view;
            }
        }
        return view;
    },

    destroyItemView(view) {
        const item = view.get('content');
        if (isDestroyed(item) || (item.is && item.is(DESTROYED))) {
            view.destroy();
            delete this._views[guid(item)];
        }
    },

    getView(item) {
        return this._views[guid(item)] || null;
    },

    redrawFocused: function () {
        const item = this.get('focusedOption');
        const oldView = this._focusedOption;
        const newView = item && this.getView(item);
        if (oldView !== newView) {
            if (oldView) {
                oldView.set('isFocused', false);
            }
            if (newView) {
                newView.set('isFocused', true);
                this.scrollIntoView();
            }
            this._focusedOption = newView;
        }
    }.observes('focusedOption'),

    redrawSelected: function () {
        const item = this.get('selectedOption');
        const oldView = this._selectedOption;
        const newView = item && this.getView(item);
        if (oldView !== newView) {
            if (oldView) {
                oldView.set('isSelected', false);
            }
            if (newView) {
                newView.set('isSelected', true);
                this.scrollIntoView();
            }
            this._selectedOption = newView;
        }
    }.observes('selectedOption'),

    // 1. after    => Trigger after the list redraws, which sets new index on
    //                ListItemView.
    // 2. nextLoop => Trigger after ListItemView#layoutWillChange, which happens
    //                in the next loop after the item's index changes.
    // 3. after    => Trigger after that ListItemView has redrawn in its new
    //                position so we scroll to the right place.
    scrollIntoView: function () {
        const item = this.get('focusedOption') || this.get('selectedOption');
        const view = item && this.getView(item);
        const scrollView = this.getParent(ScrollView);
        if (!view || !scrollView || !this.get('isInDocument')) {
            return;
        }
        const top = view.getPositionRelativeTo(scrollView).top;
        const height = view.get('pxHeight');
        const scrollTop = scrollView.get('scrollTop');
        const scrollHeight = scrollView.get('pxHeight');

        if (top < scrollTop) {
            scrollView.scrollTo(0, top - (height >> 1), true);
        } else if (top + height > scrollTop + scrollHeight) {
            scrollView.scrollTo(
                0,
                top + height - scrollHeight + (height >> 1),
                true,
            );
        }
    }
        .queue('after')
        .nextLoop()
        .queue('after'),
});

export { OptionsListView };
