/*global document */

import { Class } from '../../core/Core.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import { create as el } from '../../dom/Element.js';
import { invokeInNextEventLoop } from '../../foundation/RunLoop.js';
import { POINTER_UP } from '../View.js';
import { AbstractControlView } from './AbstractControlView.js';
import { Activatable } from './Activatable.js';

/* { property, on, observes } from */
import '../../foundation/Decorators.js';

/**
    Class: O.ButtonView

    Extends: O.AbstractControlView

    A ButtonView represents an interactive rectangle in your user interface
    which the user can click/tap to perform an action. The ButtonView uses a
    <button> element in the DOM by default. If the action being performed is
    actually a navigation and just shows/hides content and does not change any
    state, semantically you should change the layer tag to an <a>.

    ### Using O.ButtonView ###

    The most common way to use O.ButtonView is to create an instance as part of
    the <O.View#draw method of your view class. For example:

        const Element = O.Element,
            el = Element.create;

        Element.appendChildren( layer, [
            el( 'h1', [
                'Which pill will you take?'
            ]),
            el( 'div.actions', [
                new O.ButtonView({
                    type: 'v-Button--danger v-Button--sizeM',
                    icon: el( 'i.icon.icon-redpill' ),
                    isDisabled: O.bind( controller, 'isNeo' ),
                    label: 'The Red Pill',
                    target: controller,
                    method: 'abort'
                }),
                new O.ButtonView({
                    type: 'v-Button--cta v-Button--sizeM',
                    icon: el( 'i.icon.icon-bluepill' ),
                    label: 'The Blue Pill',
                    target: controller,
                    method: 'proceed'
                })
            ])
        ]);

    new O.ButtonView

    ### Styling O.ButtonView ###

    The underlying DOM structure is:

        <button class="ButtonView ${view.type}">
            ${view.icon},
            <span class="label">${view.label}</span>
        </button>

    If there is no icon property set, a comment node will be inserted in its
    position.
*/
const ButtonView = Class({
    Name: 'ButtonView',

    Extends: AbstractControlView,

    Mixin: [Activatable],

    /**
        Property: O.ButtonView#isActive
        Type: Boolean
        Default: false

        If the button is a toggle (like in the case of <O.MenuButtonView>, where
        the menu is either visible or not), this property should be set to true
        when in the active state, and false when not. This provides a CSS hook
        for drawing the correct style to represent the button state.

        <O.MenuButtonView> instances will automatically set this property
        correctly, but if you subclass O.ButtonView yourself in a similar way,
        be sure to set this when the state changes.
    */
    isActive: false,

    /**
        Property: O.ButtonView#isWaiting
        Type: Boolean
        Default: false

        Is the button waiting for something to complete? Setting this to true
        will disable the button and add an 'is-waiting' class name.
    */
    isWaiting: false,

    /**
        Property: O.ButtonView#type
        Type: Element|null
        Default: null

        An element to insert before the label.
    */
    icon: null,

    /**
        Property: O.ButtonView#label
        Type: String|null
        Default: ''

        Label text drawn within the button.
    */
    label: '',

    // --- Render ---

    /**
        Property: O.ButtonView#layerTag
        Type: String
        Default: 'button'

        Overrides default in <O.View#layerTag>.
    */
    layerTag: 'button',

    /**
        Property: O.ButtonView#baseClassName
        Type: String
        Default: 'v-Button'

        Overrides default in <O.AbstractControlView#baseClassName>.
    */
    baseClassName: 'v-Button',

    /**
        Property: O.ButtonView#className
        Type: String

        Overrides default in <O.View#className>. The layer will always have the
        class "ButtonView" plus any classes listed in the <O.ButtonView#type>
        property. In addition, it may have the following classes depending on
        the state:

        hasIcon     - If the view has an icon property set.
        active      - If the view's isActive property is true.
        disabled    - If the view's isDisabled property is true.
    */
    className: function () {
        const type = this.get('type');
        return (
            this.get('baseClassName') +
            (type ? ' ' + type : '') +
            (this.get('icon') ? ' has-icon' : '') +
            (this.get('isActive') ? ' is-active' : '') +
            (this.get('isWaiting') ? ' is-waiting' : '') +
            (this.get('isDisabled') ? ' is-disabled' : '')
        );
    }.property('type', 'icon', 'isActive', 'isWaiting', 'isDisabled'),

    drawLabel(label) {
        return el('span.label', [label]);
    },

    /**
        Method: O.ButtonView#draw

        Overridden to draw view. See <O.View#draw>. For DOM structure, see
        general <O.ButtonView> notes.
    */
    draw(layer) {
        this._domControl = layer;
        // This stops the button acting as a submit button when inside a <form>;
        // this fixes some weird behaviour where the browser can simulate a
        // click on the button when the user hits enter on another field inside
        // the form.
        layer.type = 'button';

        let icon = this.get('icon');
        if (!icon) {
            icon = document.createComment('icon');
        }

        let label = this.get('label');
        if (label) {
            label = this.drawLabel(label);
        } else {
            label = document.createComment('label');
        }
        this._domLabel = label;

        this.redrawIsDisabled(layer);
        this.redrawTabIndex(layer);

        return [icon, label];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.ButtonView#buttonNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    buttonNeedsRedraw: function (self, property, oldValue) {
        if (property === 'isWaiting') {
            property = 'isDisabled';
        }
        return this.propertyNeedsRedraw(self, property, oldValue);
    }.observes('icon', 'isWaiting', 'label'),

    redrawIcon(layer) {
        let icon = this.get('icon');
        if (!icon) {
            icon = document.createComment('icon');
        }
        layer.replaceChild(icon, layer.firstChild);
    },

    redrawIsDisabled() {
        this._domControl.disabled =
            this.get('isDisabled') || this.get('isWaiting');
    },

    redrawLabel(layer) {
        let label = this.get('label');
        if (label) {
            label = this.drawLabel(label);
            layer.replaceChild(label, this._domLabel);
            this._domLabel = label;
            this.fire('button:resize');
        }
    },

    // --- Activate ---

    /**
        Property: O.ButtonView#target
        Type: Object|null
        Default: null

        The object to fire an event/call a method on when the button is
        activated. If null (the default), the ButtonView instance itself will be
        used.
    */
    target: null,

    /**
        Property: O.ButtonView#action
        Type: String|null
        Default: null

        The name of the event to fire on the <#target> when the button is
        activated. Note, you should set *either* the action property or the
        <#method> property. If both are set, the action property will be
        ignored.
    */
    action: null,

    /**
        Property: O.ButtonView#method
        Type: String|null
        Default: null

        The name of the method to call on the <#target> when the button is
        activated. Note, you should set *either* the <#action> property or the
        method property. If both are set, the action property will be ignored.
    */
    method: null,

    /**
        Method: O.ButtonView#activate

        This method is called when the button is triggered, either by being
        clicked/tapped on, or via a keyboard shortcut. If the button is
        disabled, it will do nothing. Otherwise, it calls the method named in
        the <#method> property on the object instead. Or, if no method is
        defined, it fires an event with the name given in the <#action> property
        on the <#target> object, if one is set.

        If an event is fired, the `originView` property of the event object
        provides a reference back to the button that fired it. If a method is
        called, the ButtonView instance will be passed as the sole argument.

        It also fires an event called `button:activate` on itself.
    */
    activate(event) {
        if (!this.get('isDisabled') && !this.get('isWaiting')) {
            this.isKeyActivation =
                !!event && !!event.type && event.type.startsWith('key');
            const target = this.get('target') || this;
            const method = this.get('method');
            const action = method ? null : this.get('action');
            if (method) {
                target[method](this, event);
            } else if (action) {
                target.fire(action, { originView: this, originEvent: event });
            }
            this.fire('button:activate');
        }
    },

    // --- Keep state in sync with render ---

    /**
        Property: O.ButtonView#noRepeatWithin
        Type: Number

        Time in ms to ignore further clicks after being clicked. By default,
        this is 200ms, which encompasses most double clicks. So for people that
        automatically double click everything (yep! that's a type of user), we
        won't trigger twice. This is important if you automatically select the
        next item after applying an action.
    */
    noRepeatWithin: 200,

    /**
        Property (private): O.ButtonView#_ignoreUntil
        Type: Number

        We want to trigger on mouseup so that the button can be used in a menu
        in a single click action. However, we also want to trigger on click for
        accessibility reasons. We don't want to trigger twice though, and at the
        time of the mouseup event there's no way to know if a click event will
        follow it. However, if a click event *is* following it, the click event
        will already be in the event queue, so we temporarily ignore clicks and
        put a callback function onto the end of the event queue to stop
        ignoring them. We can also add any delay for the noRepeatWithin property
        to extend the time we ignore further clicks.
    */
    _ignoreUntil: 0,

    /**
        Method (private): O.ButtonView#_setIgnoreUntil
    */
    _setIgnoreUntil() {
        this._ignoreUntil = Date.now() + this.get('noRepeatWithin');
    },

    /**
        Method: O.ButtonView#mouseActivate

        Activates the button on normal clicks.

        Parameters:
            event - {Event} The click or mouseup event.
    */
    mouseActivate: function (event) {
        if (
            this._ignoreUntil > Date.now() ||
            event.button ||
            event.metaKey ||
            event.ctrlKey
        ) {
            return;
        }
        if (
            event.type !== POINTER_UP ||
            this.getParentWhere((x) => x.isMenuView)
        ) {
            this._ignoreUntil = 4102444800000; // 1st Jan 2100...
            invokeInNextEventLoop(this._setIgnoreUntil, this);
            this.activate(event);
            event.preventDefault();
            // Firefox keeps focus on the button after clicking. If the user
            // then hits "space", it will activate the button again!
            this.blur();
        }
    }.on(POINTER_UP, 'click'),

    /**
        Method: O.ButtonView#keyboardActivate

        Activates the button when it has keyboard focus and the `enter` or
        `space` key is pressed.

        Parameters:
            event - {Event} The keypress event.
    */
    keyboardActivate: function (event) {
        const key = lookupKey(event);
        if (key === 'Enter' || key === 'Space') {
            this.activate(event);
            event.preventDefault();
            // Don't want to trigger global keyboard shortcuts
            event.stopPropagation();
        }
        if (key === 'Escape') {
            this.blur();
            event.stopPropagation();
        }
    }.on('keydown'),
});

export { ButtonView };
