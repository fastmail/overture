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

    // --- Render ---

    layerTag: 'button',
    className: function () {
        var type = this.get( 'type' );
        return 'ButtonView' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'shortcut' ) ? ' hasShortcut' : '' ) +
            ( this.get( 'isActive' ) ? ' active' : '' );
    }.property( 'type', 'shortcut', 'isActive' ),

    _render: function ( layer ) {
        var icon = this.get( 'icon' );
        if ( icon ) {
            layer.appendChild( NS.Element.create( 'i', { className: icon } ) );
        }
        layer.tabIndex = -1;

        this._domControl = layer;
        ButtonView.parent._render.call( this, layer );
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

    // --- Activate ---

    activate: function () {
        if ( !this.get( 'isDisabled' ) && !this.get( 'isActive' ) ) {
            var buttonView = this;
            this.set( 'isActive', true );
            this.get( 'popOverView' ).show({
                view: this.get( 'menuView' ),
                alignWithView: this,
                onHide: function () {
                    buttonView.set( 'isActive', false );
                }
            });
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
