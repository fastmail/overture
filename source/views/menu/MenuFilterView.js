import { Class } from '../../core/Core.js';
import Obj from '../../foundation/Object.js';
import '../../foundation/Decorators.js';
import { bind, bindTwoWay } from '../../foundation/Binding.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import View from '../View.js';
import ScrollView from '../containers/ScrollView.js';
import ViewEventsController from '../ViewEventsController.js';
import SearchTextView from '../controls/SearchTextView.js';

const MenuFilterView = Class({
    Extends: View,

    isFiltering: bind('controller*isFiltering'),

    ariaAttributes: {
        hidden: 'true',
    },

    className: function () {
        return (
            'v-MenuFilter' + (this.get('isFiltering') ? ' is-filtering' : '')
        );
    }.property('isFiltering'),

    draw(/* layer */) {
        const controller = this.get('controller');
        const searchTextView = (this._input = new SearchTextView({
            shortcut: this.get('shortcut'),
            placeholder: this.get('placeholder'),
            tabIndex: -1,
            blurOnKeys: {},
            value: bindTwoWay(controller, 'search'),
        }));

        return searchTextView;
    },

    // ---

    focus() {
        this._input.focus();
        return this;
    },

    blur() {
        this._input.blur();
        return this;
    },

    setup: function () {
        const controller = this.get('controller');
        if (this.get('isInDocument')) {
            controller.on('done', this, 'blur');
        } else {
            controller.off('done', this, 'blur');
            controller.set('isFiltering', false);
        }
    }.observes('isInDocument'),

    // ---

    didFocus: function () {
        this.get('controller').set('isFiltering', true);
        const scrollView = this.getParent(ScrollView);
        if (scrollView) {
            scrollView.scrollTo(0, 0, false);
        }
    }.on('focus'),

    handler: function () {
        return new Obj({
            view: this._input,
            controller: this.get('controller'),
            done: function () {
                if (!this.view.get('isFocused')) {
                    this.controller.set('isFiltering', false);
                }
            }
                .queue('after')
                .on('click', 'keydown'),
        });
    }.property(),

    captureEvents: function (_, __, ___, isFiltering) {
        const handler = this.get('handler');
        if (isFiltering) {
            ViewEventsController.addEventTarget(handler, 15);
        } else {
            ViewEventsController.removeEventTarget(handler);
        }
    }.observes('isFiltering'),

    // ---

    keydown: function (event) {
        const controller = this.get('controller');
        let scrollView;
        switch (lookupKey(event)) {
            case 'Escape':
                if (controller.get('search')) {
                    controller.resetSearch();
                } else {
                    controller.done();
                }
                break;
            case 'Enter':
                controller.selectFocused();
                break;
            case 'ArrowUp':
                controller.focusPrevious();
                break;
            case 'ArrowDown':
                controller.focusNext();
                break;
            case 'ArrowLeft':
                if (!controller.collapseFocused()) {
                    return;
                }
                break;
            case 'ArrowRight':
                if (!controller.expandFocused()) {
                    return;
                }
                break;
            default:
                scrollView = this.getParent(ScrollView);
                if (scrollView) {
                    scrollView.scrollTo(0, 0, false);
                }
                return;
        }
        event.stopPropagation();
        event.preventDefault();
    }.on('keydown'),
});

export default MenuFilterView;
