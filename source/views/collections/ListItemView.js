import { Class } from '../../core/Core.js';
import /* { property, nextFrame } from */ '../../foundation/Decorators.js';
import View from '../View.js';

const ListItemView = Class({
    Extends: View,

    content: null,

    index: 0,
    itemHeight: 32,

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
        const index = this.get('index');
        const itemHeight = this.get('itemHeight');
        const animateIn = this.get('animateIn');
        const isNew = animateIn && !this.get('isInDocument');
        const y = (index - (isNew ? 1 : 0)) * itemHeight;
        return {
            top: y,
            opacity: animateIn ? (isNew ? 0 : 1) : undefined,
        };
    }.property(),

    layoutWillChange: function () {
        this.computedPropertyDidChange('layout');
    }
        .nextLoop()
        .observes('index', 'itemHeight'),

    resetLayout: function () {
        if (this.get('animateIn')) {
            this.computedPropertyDidChange('layout');
        }
    }
        .nextLoop()
        .observes('isInDocument'),
});

export default ListItemView;
