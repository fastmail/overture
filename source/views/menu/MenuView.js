import { Class } from '../../core/Core.js';
import '../../foundation/Decorators.js';
import Obj from '../../foundation/Object.js';
import { bind } from '../../foundation/Binding.js';
import ObservableArray from '../../foundation/ObservableArray.js';
import { queueFn, invokeInNextFrame } from '../../foundation/RunLoop.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import OptionsController from '../../selection/OptionsController.js';
import View from '../View.js';
import ViewEventsController from '../ViewEventsController.js';
import ScrollView from '../containers/ScrollView.js';
import OptionsListView from '../collections/OptionsListView.js';
import PopOverView from '../panels/PopOverView.js';
import MenuButtonView from './MenuButtonView.js';
import MenuFilterView from './MenuFilterView.js';
import MenuOptionView from './MenuOptionView.js';

const MenuOption = Class({
    Extends: Obj,

    init: function (button, controller) {
        this.button = button;
        this.controller = controller;
    },

    isDisabled: function () {
        return this.get('button').get('isDisabled');
    }
        .property()
        .nocache(),

    name: function () {
        const button = this.get('button');
        return button.get('filterName') || button.get('label');
    }
        .property()
        .nocache(),
});

const MenuController = Class({
    Extends: OptionsController,

    init: function (view, content, isFiltering) {
        this.options = new ObservableArray();
        this.view = view;
        this.content = content.map((button) => new MenuOption(button, this));
        MenuController.parent.constructor.call(this, {
            isFiltering,
        });
    },

    collapseFocused() {
        const view = this.get('view');
        let popOverView;
        if (
            !view.get('showFilter') &&
            (popOverView = view.getParent(PopOverView)) &&
            popOverView.get('parentPopOverView')
        ) {
            view.hide();
        }
    },

    expandFocused() {
        const focused = this.get('focused');
        if (focused && focused.get('button') instanceof MenuButtonView) {
            this.selectFocused();
        }
    },

    select(item) {
        const button = item.get('button');
        if (button.activate) {
            button.activate();
        }
    },

    done() {
        this.get('view').hide();
    },

    // ---

    viewMayHaveResized: function () {
        this.get('view').parentViewDidResize();
    }
        .queue('after')
        .observes('search'),
});

const MenuView = Class({
    Extends: View,

    className: 'v-Menu',

    isMenuView: true,
    showFilter: false,
    closeOnActivate: true,

    controller: function () {
        return new MenuController(
            this,
            this.get('options'),
            this.get('showFilter'),
        );
    }.property(),

    didEnterDocument() {
        MenuView.parent.didEnterDocument.call(this);

        const layer = this.get('layer');
        layer.addEventListener('mousemove', this, false);
        layer.addEventListener('mouseout', this, false);

        if (!this.showFilter) {
            const scrollView = this.scrollView;
            queueFn('after', scrollView.focus, scrollView);
        }

        return this;
    },

    didLeaveDocument() {
        const controller = this.get('controller');
        const layer = this.get('layer');

        if (this.get('showFilter')) {
            controller.set('search', '');
        } else {
            controller.focus(null);
        }

        layer.removeEventListener('mouseout', this, false);
        layer.removeEventListener('mousemove', this, false);

        return MenuView.parent.didLeaveDocument.call(this);
    },

    ItemView: MenuOptionView,

    draw(/* layer */) {
        const controller = this.get('controller');
        return [
            (this.filterView = this.get('showFilter')
                ? new MenuFilterView({
                      controller,
                  })
                : null),
            (this.scrollView = new ScrollView({
                positioning: 'relative',
                layout: {},
                childViews: [
                    new OptionsListView({
                        controller,
                        layerTag: 'ul',
                        content: bind(controller, 'options'),
                        getViewTypeForItem: () => this.get('ItemView'),
                    }),
                ],
            })),
        ];
    },

    hide() {
        const parent = this.get('parentView');
        if (parent) {
            invokeInNextFrame(parent.hide, parent);
        }
    },

    buttonDidActivate: function () {
        if (this.get('closeOnActivate')) {
            let popOverView =
                this.getParent(PopOverView) || this.get('parentView');
            let parent;
            if (popOverView) {
                while ((parent = popOverView.get('parentPopOverView'))) {
                    popOverView = parent;
                }
                popOverView.hide();
            }
        }
    }
        .nextFrame()
        .on('button:activate'),

    keydown: function (event) {
        const key = lookupKey(event);
        const controller = this.get('controller');
        switch (key) {
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
                if (!this.get('showFilter')) {
                    const kbShortcuts = ViewEventsController.kbShortcuts;
                    const handler = kbShortcuts.getHandlerForKey(key);
                    if (handler) {
                        const object = handler[0];
                        const method = handler[1];
                        // Check object is child view of the menu; we want to
                        // ignore any other keyboard shortcuts.
                        if (object instanceof View) {
                            let parent = object;
                            while (parent && parent !== this) {
                                parent = parent.get('parentView');
                            }
                            if (parent) {
                                object[method](event);
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        }
                    }
                }
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }.on('keydown'),
});

export default MenuView;
