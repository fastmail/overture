import { Class } from '../../core/Core.js';
import /* { property, on, observes } from */ '../../foundation/Decorators.js';
import { invokeAfterDelay, cancel } from '../../foundation/RunLoop.js';
import { View } from '../View.js';
import { PopOverView } from '../panels/PopOverView.js';

const MenuOptionView = Class({
    Name: 'MenuOptionView',

    Extends: View,

    destroy() {
        this.removeView(this.get('childViews')[0]);
        MenuOptionView.parent.destroy.call(this);
    },

    isFocused: false,

    layerTag: 'li',

    className: function () {
        return 'v-MenuOption' + (this.get('isFocused') ? ' is-focused' : '');
    }.property('isFocused'),

    draw(/* layer */) {
        return this.get('content').get('button');
    },

    _focusTimeout: null,

    takeFocus() {
        if (this.get('isInDocument')) {
            this.get('controller').focus(this.get('content')).expandFocused();
        }
    },

    mousemove: function () {
        if (!this.get('isFocused') && !this._focusTimeout) {
            const popOverView = this.getParent(PopOverView);
            if (popOverView && popOverView.hasSubView()) {
                this._focusTimeout = invokeAfterDelay(this.takeFocus, 75, this);
            } else {
                this.takeFocus();
            }
        }
    }.on('mousemove'),

    mouseout: function () {
        if (this._focusTimeout) {
            cancel(this._focusTimeout);
            this._focusTimeout = null;
        }
        if (
            this.get('isFocused') &&
            !this.get('childViews')[0].get('isActive')
        ) {
            this.get('controller').focus(null);
        }
    }.on('mouseout'),
});

export { MenuOptionView };
