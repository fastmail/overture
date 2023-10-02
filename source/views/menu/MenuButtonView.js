import { Class } from '../../core/Core.js';
import { getViewFromNode } from '../activeViews.js';
import { ButtonView } from '../controls/ButtonView.js';
import { FileButtonView } from '../controls/FileButtonView.js';
import { PopOverView } from '../panels/PopOverView.js';
import { RootView } from '../RootView.js';
import { MenuFilterView } from './MenuFilterView.js';
import { MenuOptionView } from './MenuOptionView.js';

/* { observes, on, property, queue } from */
import '../../foundation/Decorators.js';

/*global document */

/**
    Class: O.MenuButtonView

    Extends: O.ButtonView

    A MenuButtonView reveals a menu when pressed. Example usage:

        new O.MenuButtonView({
            label: 'Select File',
            popOverView: new O.PopOverView(),
            menuView: new O.MenuView({
                showFilter: false,
                closeOnActivate: true,
                options: [
                    new O.FileButtonView({
                        label: 'Upload From Computer',
                        acceptMultiple: true,
                        target: controller,
                        method: 'uploadFiles'
                    }),
                    new O.ButtonView({
                        label: 'Select From Dropbox',
                        target: controller,
                        method: 'selectFromDropbox'
                    })
                ]
            })
        });
*/
const MenuButtonView = Class({
    Name: 'MenuButtonView',

    Extends: ButtonView,

    /**
        Property: O.MenuButtonView#type
        Type: String
        Default: 'v-MenuButton'

        Overrides default in <O.ButtonView#type>.
    */
    baseClassName: 'v-MenuButton',

    className: function () {
        return 'v-Button ' + ButtonView.prototype.className.call(this);
    }.property(...ButtonView.prototype.className.dependencies),

    /**
        Property: O.MenuButtonView#popOverView
        Type: O.PopOverView

        The <O.PopOverView> instance to use to show the menu view.
    */
    popOverView: null,

    /**
        Property: O.MenuButtonView#popOverViewOptions
        Type: Object

        Options to pass to <O.PopOverView#show>.
    */
    popOverOptions: {},

    /**
        Property: O.MenuButtonView#menuView
        Type: O.MenuView

        The <O.MenuView> instance to show when the button is pressed.
    */
    menuView: null,

    /**
        Property: O.MenuButtonView#destroyMenuViewOnClose
        Type: Boolean

        If the menu view is regenerated each time it is opened, set this to
        true to destroy the view when the pop over is closed.
    */
    destroyMenuViewOnClose: false,

    /**
        Property: O.MenuButtonView#alignMenu
        Type: String
        Default: 'left'

        Which of the menu and button edges should be aligned? Valid options are
        'left', 'right' or 'centre'.
    */
    alignMenu: 'left',

    /**
        Property: O.MenuButtonView#isInMenu
        Type: Boolean

        Is this a child view of an <O.MenuOptionView>?
    */
    isInMenu: function () {
        return this.get('parentView') instanceof MenuOptionView;
    }.property('parentView'),

    /**
        Property: O.MenuButtonView#activateOnMenuFocus
        Type: Boolean

        When nested within another menu, set to false to prevent menuView from
        being activated when focused.
    */
    activateOnMenuFocus: true,

    // --- Accessibility ---

    didCreateLayer(layer) {
        MenuButtonView.parent.didCreateLayer.call(this, layer);
        layer.setAttribute('aria-expanded', 'false');
    },

    ariaNeedsRedraw: function (self, property, oldValue) {
        return this.propertyNeedsRedraw(self, 'aria', oldValue);
    }.observes('isActive'),

    redrawAria(layer) {
        // Set ARIA attribute to link the menu DOM element to this
        // button, so screen readers know what has opened.
        layer.setAttribute('aria-controls', this.getFromPath('menuView.id'));
        // And set ARIA attribute to say that the menu is now open
        layer.setAttribute('aria-expanded', this.get('isActive') + '');
    },

    focusAfterMenu: function () {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) {
            this.focus();
        }
    }
        .queue('after')
        .on('focusAfterMenu'),

    // --- Activate ---

    /**
        Method: O.MenuButtonView#activate

        Overridden to show menu associated with button, if not already visible.
        Ignores target/method/action properties.
    */
    activate(event) {
        if (!this.get('isActive') && !this.get('isDisabled')) {
            this.isKeyActivation =
                !!event && !!event.type && event.type.startsWith('key');
            this.set('isActive', true);
            const buttonView = this;
            const wasFocused = this.get('isFocused');
            const menuView = this.get('menuView');
            let popOverView;
            let menuOptionView;
            const popOverOptions = Object.assign(
                {
                    view: menuView,
                    alignWithView: buttonView,
                    alignEdge: this.get('alignMenu'),
                    onHide() {
                        buttonView.set('isActive', false);
                        if (wasFocused) {
                            buttonView.fire('focusAfterMenu');
                        }
                        if (menuOptionView) {
                            menuOptionView
                                .get('controller')
                                .removeObserverForKey(
                                    'focused',
                                    popOverView,
                                    'hide',
                                );
                        }
                        if (buttonView.get('destroyMenuViewOnClose')) {
                            menuView.destroy();
                        }
                    },
                },
                this.get('popOverOptions'),
            );
            if (this.get('isInMenu')) {
                popOverView = this.getParent(PopOverView);
                const parentOptions = popOverView.get('options');
                popOverOptions.showCallout = false;
                if (this.get('activateOnMenuFocus')) {
                    const preferLeft = parentOptions.positionToThe === 'left';
                    const rootViewWidth =
                        this.getParent(RootView).get('pxWidth');
                    const position = this.get('layer').getBoundingClientRect();
                    menuOptionView = this.get('parentView');
                    popOverOptions.alignWithView = popOverView;
                    popOverOptions.atNode = this.get('layer');
                    popOverOptions.positionToThe =
                        preferLeft && position.left > position.width
                            ? 'left'
                            : !preferLeft &&
                              rootViewWidth - position.right > position.width
                            ? 'right'
                            : position.left < rootViewWidth - position.right
                            ? 'right'
                            : 'left';
                    popOverOptions.keepInHorizontalBounds = true;
                    popOverOptions.alignEdge = 'top';
                    popOverOptions.offsetTop = popOverOptions.view.get(
                        'showFilter',
                    )
                        ? -35
                        : -5;
                    popOverOptions.offsetLeft = 0;
                } else {
                    popOverOptions.alignWithView = parentOptions.alignWithView;
                    popOverOptions.atNode = parentOptions.atNode;
                }
            } else {
                popOverView = this.get('popOverView');
            }
            // If the isInMenu, the popOverView used will actually be a subview
            // of this popOverView, and is returned from the show method.
            popOverView = popOverView.show(popOverOptions);
            if (menuOptionView) {
                menuOptionView
                    .get('controller')
                    .addObserverForKey('focused', popOverView, 'hide');
            }
        }
    },

    // --- Keep state in sync with render ---

    /**
        Method (private): O.MenuButtonView#_activateOnMousedown

        Activates the button on mousedown, not just on click. This allows the
        user to press the mouse down on the button to show the menu, drag down
        to the option they want, then release the button to select it.
    */
    _activateOnMousedown: function (event) {
        if (event.button || event.metaKey || event.ctrlKey) {
            return;
        }
        this.activate(event);
    }.on('mousedown'),

    _activateOnTouchstart: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._didMove = false;
        this._touchedView = null;
        this.activate(event);
    }.on('touchstart'),

    _handleTouchmove: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._didMove = true;
        const touch = event.changedTouches[0];
        if (!touch) {
            return;
        }
        const clientX =
            touch.clientX > -Infinity && touch.clientX < Infinity
                ? touch.clientX
                : null;
        const clientY =
            touch.clientY > -Infinity && touch.clientY < Infinity
                ? touch.clientY
                : null;

        if (!clientX || !clientY) {
            return;
        }

        const node = document.elementFromPoint(clientX, clientY);
        if (!node) {
            return;
        }
        const view = getViewFromNode(node);
        if (!view) {
            return;
        }

        const menuOption =
            (view instanceof MenuOptionView && view) ||
            view.getParent(MenuOptionView);
        if (menuOption) {
            menuOption.takeFocus();
            this._touchedView = menuOption;
            return;
        }

        const menuFilter =
            (view instanceof MenuFilterView && view) ||
            view.getParent(MenuFilterView);
        if (menuFilter) {
            this._touchedView = menuFilter;
            return;
        }

        this._touchedView = view;
    }.on('touchmove'),

    _handleTouchend: function (event) {
        event.preventDefault();
        event.stopPropagation();
        const view = this._touchedView;
        if (
            !this._didMove ||
            view === this ||
            view === this.get('popOverView')
        ) {
            return;
        }
        if (view instanceof MenuOptionView) {
            const button = view.getFromPath('content.button');
            if (button instanceof FileButtonView) {
                button.fire('confirm', event);
                this.get('popOverView').hide();
            } else {
                view.get('controller').selectFocused();
            }
        } else if (view instanceof MenuFilterView) {
            view.focus();
        } else {
            this.get('popOverView').hide();
        }
    }.on('touchend'),
});

export { MenuButtonView };
