import { Class } from '../../core/Core.js';
import { invokeInNextEventLoop } from '../../foundation/RunLoop.js';
import { View } from '../View.js';

/* { property, nextFrame } from */
import '../../foundation/Decorators.js';

const ListItemView = Class({
    Name: 'ListItemView',

    Extends: View,

    content: null,

    index: 0,
    itemLayout: 0,

    selection: null,
    isSelected: false,

    animateIn: false,

    init: function (mixin) {
        const selection = mixin.selection;
        const content = mixin.content;
        if (selection && content) {
            this.isSelected = selection.isStoreKeySelected(
                content.get('storeKey'),
            );
        }
        ListItemView.parent.constructor.call(this, mixin);
    },

    positioning: 'absolute',

    layout: function () {
        const listView = this.get('parentView');
        let top = listView.indexToOffset(this.get('index'));
        const animateIn = this.get('animateIn');
        const isNew = animateIn && !this.get('isInDocument');
        if (isNew) {
            top -= listView.get('itemHeight');
        }

        return {
            top,
            opacity: animateIn ? (isNew ? 0 : 1) : undefined,
        };
    }.property(),

    invalidateLayout() {
        this.computedPropertyDidChange('layout');
    },

    layoutWillChange: function () {
        if (this.get('animateLayer')) {
            invokeInNextEventLoop(this.invalidateLayout, this);
        } else {
            this.invalidateLayout();
        }
    }.observes('index', 'itemLayout'),

    resetLayout: function () {
        if (this.get('animateIn')) {
            this.invalidateLayout();
        }
    }
        .nextLoop()
        .observes('isInDocument'),
});

export { ListItemView };
