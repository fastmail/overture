// -------------------------------------------------------------------------- \\
// File: ButtonView.js                                                        \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View, AbstractControlView.js              \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.ButtonView

    Extends: O.AbstractControlView

    A ButtonView represents an interactive rectangle in your user interface
    which the user can click/tap to perform an action. The ButtonView uses a
    <button> element in the DOM by default. If the action being perfomed is
    actually a navigation and just shows/hides content and does not change any
    state, semantically you should change the layer tag to an <a>.

    ### Using O.ButtonView ###

    The most common way to use O.ButtonView is to create an instance as part of
    the <O.View#draw method of your view class. For example:

        var Element = O.Element,
            el = Element.create;

        Element.appendChildren( layer, [
            el( 'h1', [
                'Which pill will you take?'
            ]),
            el( 'div.actions', [
                new O.ButtonView({
                    type: 'v-Button--destructive v-Button--size13',
                    icon: 'redpill',
                    isDisabled: O.bind( controller, 'isNeo' ),
                    label: 'The Red Pill',
                    target: controller,
                    method: 'abort'
                }),
                new O.ButtonView({
                    type: 'v-Button--constructive v-Button--size13',
                    icon: 'bluepill',
                    label: 'The Blue Pill',
                    target: controller,
                    method: 'proceed'
                })
            ])
        ]);

    new O.ButtonView

    ### Styling O.ButtonView ###

    The underlying DOM structure is:

        <button class="ButtonView ${view.type}">
            <i class="${view.icon}"></i>
            <span>${view.label}</span>
        </button>

    If there is no icon property set, the <i> will have a class of 'hidden'
    instead. The icon can be drawn as a background to the empty <i> element.
*/
var ButtonView = NS.Class({

    Extends: NS.AbstractControlView,

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
        Property: O.ButtonView#type
        Type: String
        Default: ''

        A space-separated list of CSS classnames to give the layer in the DOM,
        irrespective of state.
    */
    type: '',

    /**
        Property: O.ButtonView#type
        Type: String
        Default: ''

        Set to the name of the icon to use, if any, for the button. See the
        general notes on using <O.ButtonView> for more information.
    */
    icon: '',

    /**
        Property: O.ButtonView#tabIndex
        Type: Number
        Default: -1

        Overrides default in <O.AbstractControlView#tabIndex>.
    */
    tabIndex: -1,

    // --- Render ---

    /**
        Property: O.ButtonView#layerTag
        Type: String
        Default: 'button'

        Overrides default in <O.View#layerTag>.
    */
    layerTag: 'button',

    /**
        Property: O.ButtonView#className
        Type: String

        Overrides default in <O.View#className>. The layer will always have the
        class "ButtonView" plus any classes listed in the <O.ButtonView#type>
        property. In addition, it may have the following classes depending on
        the state:

        hasIcon     - If the view has an icon property set.
        hasShortcut - If the view has a shortcut property set.
        active      - If the view's isActive property is true.
        disabled    - If the view's isDisabled property is true.
    */
    className: function () {
        var type = this.get( 'type' );
        return 'v-Button' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'icon' ) ? ' v-Button--hasIcon' : '' ) +
            ( this.get( 'shortcut' ) ? ' v-Button--hasShortcut' : '' ) +
            ( this.get( 'isActive' ) ? ' is-active' : '' ) +
            ( this.get( 'isDisabled' ) ? ' is-disabled' : '' );
    }.property( 'type', 'icon', 'shortcut', 'isActive', 'isDisabled' ),

    /**
        Method: O.ButtonView#draw

        Overridden to draw view. See <O.View#draw>. For DOM structure, see
        general <O.ButtonView> notes.
    */
    draw: function ( layer, Element, el ) {
        var icon = this.get( 'icon' );
        this._domControl = layer;
        return [
            el( 'i', {
                className: icon ? 'icon ' + icon : 'u-hidden'
            }),
            ButtonView.parent.draw.call( this, layer, Element, el )
        ];
    },

    // --- Keep render in sync with state ---

    /**
        Method: O.ButtonView#buttonNeedsRedraw

        Calls <O.View#propertyNeedsRedraw> for extra properties requiring
        redraw.
    */
    buttonNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'icon' ),

    /**
        Method: O.ButtonView#redrawIcon

        Updates the className of the <i> representing the button's icon.
    */
    redrawIcon: function ( layer ) {
        var icon = this.get( 'icon' );
        layer.firstChild.className = icon ? 'icon ' + icon : 'u-hidden';
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
        <#method> property. If both are set, the method property will be
        ignored.
    */
    action: null,

    /**
        Property: O.ButtonView#method
        Type: String|null
        Default: null

        The name of the method to call on the <#target> when the button is
        activated. Note, you should set *either* the <#action> property or the
        method property. If both are set, the method property will be ignored.
    */
    method: null,

    /**
        Method: O.ButtonView#activate

        This method is called when the button is triggered, either by being
        clicked/tapped on, or via a keyboard shortcut. If the button is
        disabled, it will do nothing. Otherwise, it fires an event with the name
        given in the <#action> property on the <#target> object. Or, if no
        action is defined, calls the method named in the <#method> property on
        the object instead.

        If an event is fired, the `originView` property of the event object
        provides a reference back to the button that fired it. If a method is
        called, the ButtonView instance will be passed as the sole argument.

        It also fires an event called `button:activate` on itself.
    */
    activate: function () {
        if ( !this.get( 'isDisabled' ) ) {
            var target = this.get( 'target' ) || this,
                action;
            if ( action = this.get( 'action' ) ) {
                target.fire( action, { originView: this } );
            } else if ( action = this.get( 'method' ) ) {
                target[ action ]( this );
            }
            this.fire( 'button:activate' );
        }
    },

    // --- Keep state in sync with render ---

    /**
        Property (private): O.ButtonView#_ignoreUntil
        Type: Number

        Time before which we should not reactive.

        We want to trigger on mouseup so that the button can be used in a menu
        in a single click action. However, we also want to trigger on click for
        accessibility reasons. We don't want to trigger twice though, and at the
        time of the mouseup event there's no way to know if a click event will
        follow it. However, if a click event *is* following it, in most
        browsers, the click event will already be in the event queue, so we
        temporarily ignore clicks and put a callback function onto the end of
        the event queue to stop ignoring them. This will only run after the
        click event has fired (if there is one). The exception is Opera, where
        it gets queued before the click event. By adding a minimum 200ms delay
        we can more or less guarantee it is queued after, and it also prevents
        double click from activating the button twice, which could have
        unintended effects.
    */
    _ignoreUntil: 0,

    /**
        Method (private): O.ButtonView#_setIgnoreUntil
    */
    _setIgnoreUntil: function () {
        this._ignoreUntil = Date.now() + 200;
    },

    /**
        Method (private): O.ButtonView#_activateOnClick

        Activates the button on normal clicks.

        Parameters:
            event - {Event} The click or mouseup event.
    */
    _activateOnClick: function ( event ) {
        if ( this._ignoreUntil > Date.now() ||
                event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        if ( event.type !== 'mouseup' || this.getParent( NS.MenuView ) ) {
            this._ignoreUntil = 4102444800000; // 1st Jan 2100...
            NS.RunLoop.invokeInNextEventLoop( this._setIgnoreUntil, this );
            this.activate();
            event.preventDefault();
            // Firefox keeps focus on the button after clicking. If the user
            // then hits "space", it will activate the button again!
            this.blur();
        }
    }.on( 'mouseup', 'click' ),

    /**
        Method (private): O.ButtonView#_activateOnEnter

        Activates the button when it has keyboard focus and the `enter` key is
        pressed.

        Parameters:
            event - {Event} The keypress event.
    */
    _activateOnEnter: function ( event ) {
        if ( NS.DOMEvent.lookupKey( event ) === 'enter' ) {
            this.activate();
            // Don't want to trigger global keyboard shortcuts
            event.stopPropagation();
        }
    }.on( 'keypress' )
});

NS.ButtonView = ButtonView;

}( O ) );
