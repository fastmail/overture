// -------------------------------------------------------------------------- \\
// File: ButtonView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ButtonView = NS.Class({

    Extends: NS.AbstractControlView,

    isActive: false,

    type: '',
    icon: '',

    tabIndex: -1,

    // --- Render ---

    layerTag: 'button',
    className: function () {
        var type = this.get( 'type' );
        return 'ButtonView' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'shortcut' ) ? ' hasShortcut' : '' ) +
            ( this.get( 'isActive' ) ? ' active' : '' ) +
            ( this.get( 'isDisabled' ) ? ' disabled' : '' );
    }.property( 'type', 'shortcut', 'isActive', 'isDisabled' ),

    draw: function ( layer ) {
        var icon = this.get( 'icon' );
        if ( icon ) {
            layer.appendChild(
                NS.Element.create( 'i', {
                    className: icon
                })
            );
        }

        this._domControl = layer;
        ButtonView.parent.draw.call( this, layer );
    },

    // --- Keep render in sync with state ---

    propertyNeedsRedraw: function () {
        return ButtonView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles',
        'isDisabled', 'label', 'tooltip', 'tabIndex',
        'icon' ),

    redrawIcon: function ( layer ) {
        layer.firstChild.className = this.get( 'icon' );
    },

    // --- Activate ---

    target: null,
    action: null,
    method: '',

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

    // We want to trigger on mouseup so that the button can be used in a menu in
    // a single click action. However, we also want to trigger on click for
    // accessibility reasons. We don't want to trigger twice though, and at the
    // time of the mouseup event there's no way to know if a click event will
    // follow it. However, if a click event *is* following it, in most browsers,
    // the click event will already be in the event queue, so we temporarily
    // ignore clicks and put a callback function onto the end of the event queue
    // to stop ignoring them. This will only run after the click event has fired
    // (if there is one). The exception is Opera, where it gets queued before
    // the click event. By adding a small 200ms delay we can more or less
    // guarantee it is queued after, and it also prevents double click from
    // activating the button twice, which could have unintended effects.

    _ignore: false,

    _monitorClicks: function () {
        this._ignore = false;
    },

    _activateOnClick: function ( event ) {
        if ( this._ignore || event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this._ignore = true;
        NS.RunLoop.invokeAfterDelay( this._monitorClicks, 200, this );
        this.activate();
    }.on( 'mouseup', 'click' ),

    _activateOnEnter: function ( event ) {
        if ( NS.DOMEvent.lookupKey( event ) === 'enter' ) {
            this.activate();
            // Don't want to trigger global keyboard shortcuts
            event.stopPropagation();
        }
    }.on( 'keypress' )
});

NS.ButtonView = ButtonView;

var MenuButtonView = NS.Class({

    Extends: ButtonView,

    type: 'MenuButtonView',

    popOverView: null,
    menuView: null,
    alignMenu: 'left',

    isInMenu: function () {
        return this.get( 'parentView' ) instanceof NS.MenuOptionView;
    }.property( 'parentView' ),

    // --- Activate ---

    activate: function () {
        if ( !this.get( 'isDisabled' ) && !this.get( 'isActive' ) ) {
            this.set( 'isActive', true );
            var buttonView = this,
                isInMenu = this.get( 'isInMenu' ),
                popOverView, offsetTop, offsetLeft, menuOptionView;
            if ( isInMenu ) {
                popOverView = this.getParent( NS.PopOverView );
                // Align top of submenu with top of menu button.
                offsetTop = -this.get( 'pxHeight' ) - 4;
                // And to the right hand side
                offsetLeft = this.get( 'pxWidth' );
                menuOptionView = this.get( 'parentView' );
            } else {
                popOverView = this.get( 'popOverView' );
            }
            // If the isInMenu, the popOverView used will actually be a subview
            // of this popOverView, and is returned from the show method.
            popOverView = popOverView.show({
                view: this.get( 'menuView' ),
                alignWithView: isInMenu ? popOverView : this,
                atNode: isInMenu ? this.get( 'layer' ) : null,
                withEdge: this.get( 'alignMenu' ),
                offsetTop: offsetTop,
                offsetLeft: offsetLeft,
                onHide: function () {
                    buttonView.set( 'isActive', false );
                    if ( menuOptionView ) {
                        menuOptionView.removeObserverForKey(
                            'isFocussed', popOverView, 'hide' );
                    }
                }
            });
            if ( menuOptionView ) {
                menuOptionView.addObserverForKey(
                    'isFocussed', popOverView, 'hide' );
            }
        }
    },

    // --- Keep state in sync with render ---

    _activateOnMousedown: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this.activate();
    }.on( 'mousedown' )
});

NS.MenuButtonView = MenuButtonView;

}( this.O ) );
