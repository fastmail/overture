import { Class } from '../../core/Core.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import { bind } from '../../foundation/Binding.js';
import { Obj } from '../../foundation/Object.js';
import { ObservableArray } from '../../foundation/ObservableArray.js';
import { invokeInNextFrame, queueFn } from '../../foundation/RunLoop.js';
import { toBoolean } from '../../foundation/Transform.js';
import { makeSearchRegExp } from '../../localisation/i18n.js';
import { OptionsController } from '../../selection/OptionsController.js';
import { OptionsListView } from '../collections/OptionsListView.js';
import { ScrollView } from '../containers/ScrollView.js';
import { PopOverView } from '../panels/PopOverView.js';
import { View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';
import { MenuFilterView } from './MenuFilterView.js';
import { MenuOptionView } from './MenuOptionView.js';

/* { property, on, queue } from */
import '../../foundation/Decorators.js';

const MenuOption = Class({
    Name: 'MenuOption',

    Extends: Obj,

    init: function (button, controller, showAll) {
        this.button = button;
        this.controller = controller;
        this.showAll = showAll;
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
    Name: 'MenuController',

    Extends: OptionsController,

    init: function (view, content, isFiltering, showAllButton) {
        this.options = new ObservableArray();
        this.view = view;
        this.content = function (_content) {
            return _content
                .filter(toBoolean)
                .map((button) => new MenuOption(button, this));
        }.property();
        this.set('content', content);
        this.showAllButton = function (_showAllButton) {
            return _showAllButton
                ? new MenuOption(_showAllButton, this, true)
                : null;
        }.property();
        this.set('showAllButton', showAllButton);
        MenuController.parent.constructor.call(this, {
            isFiltering,
        });
    },

    optionsWillChange: function () {
        this.setOptions();
    }
        .queue('before')
        .observes('content', 'search', 'isFiltering', 'showAllButton'),

    filterOptions(content, search /*, isFiltering*/) {
        const patterns = search
            ? search.split(/\s+/).map(makeSearchRegExp)
            : null;
        const results = patterns
            ? content.filter((option) => {
                  const name = option.get('name');
                  return patterns.every((pattern) => {
                      return pattern.test(name);
                  });
              })
            : Array.isArray(content)
              ? content
              : content.get('[]');
        const showAllButton = this.get('showAllButton');
        if (showAllButton && results.last() !== showAllButton) {
            results.push(showAllButton);
        }
        return results;
    },

    selectFocused() {
        const focused = this.get('focused');
        if (focused) {
            this.select(focused);
            if (!focused.get('showAll')) {
                this.resetSearch();
            }
        }
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
        const button = focused ? focused.get('button') : null;
        if (button && button.get('activateOnMenuFocus')) {
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
        .observes('search', 'content'),
});

const MenuView = Class({
    Name: 'MenuView',

    Extends: View,

    className: 'v-Menu',

    isMenuView: true,
    showFilter: false,
    filterPlaceholder: null,
    closeOnActivate: true,

    controller: function () {
        return new MenuController(
            this,
            this.get('options'),
            this.get('showFilter'),
            this.get('showAllButton'),
        );
    }.property(),

    didEnterDocument() {
        MenuView.parent.didEnterDocument.call(this);

        const layer = this.get('layer');
        layer.addEventListener('pointermove', this, false);
        layer.addEventListener('pointerout', this, false);

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

        layer.removeEventListener('pointerout', this, false);
        layer.removeEventListener('pointermove', this, false);

        return MenuView.parent.didLeaveDocument.call(this);
    },

    ItemView: MenuOptionView,

    draw(/* layer */) {
        const controller = this.get('controller');
        return [
            (this.filterView = this.get('showFilter')
                ? new MenuFilterView({
                      placeholder: this.get('filterPlaceholder'),
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

    _shortcutHandler(event) {
        if (!this.get('showFilter')) {
            const kbShortcuts = ViewEventsController.kbShortcuts;

            const isMenuChild = (handler) => {
                const object = handler[0];
                // Check object is child view of the menu; we want to
                // ignore any other keyboard shortcuts.
                if (object instanceof View) {
                    let parent = object;
                    while (parent && parent !== this) {
                        parent = parent.get('parentView');
                    }
                    if (parent) {
                        event.preventDefault();
                        event.stopPropagation();
                        return true;
                    }
                }
                return false;
            };

            kbShortcuts.trigger(event, isMenuChild);
        }
    },

    keydown: function (event) {
        const key = lookupKey(event);
        const controller = this.get('controller');
        switch (key) {
            case 'Enter':
                controller.selectFocused();
                break;
            case 'Ctrl-k':
            case 'ArrowUp':
                controller.focusPrevious();
                break;
            case 'Ctrl-j':
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
                this._shortcutHandler(event);
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }.on('keydown'),

    keypress: function (event) {
        this._shortcutHandler(event);
    }.on('keypress'),

    contextmenu: function (event) {
        event.preventDefault();
    }.on('contextmenu'),
});

export { MenuView };
