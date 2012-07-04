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
    isFocussed: false,

    type: '',
    icon: '',

    // --- Render ---

    layerTag: 'button',
    className: function () {
        var type = this.get( 'type' );
        return 'ButtonView' +
            ( type ? ' ' + type : '' ) +
            ( this.get( 'isActive' ) ? ' active' : '' ) +
            ( this.get( 'isFocussed' ) ? ' focussed' : '' );
    }.property( 'type', 'isActive', 'isFocussed' ),

    _render: function ( layer ) {
        var Element = NS.Element,
            el = Element.create,
            icon = this.get( 'icon' );

        this._domControl = layer;
        layer.tabIndex = -1;
        layer.disabled = this.get( 'isDisabled' );
        layer.title = this.get( 'tooltip' );

        Element.appendChildren( layer, [
            icon ? el( 'i', { className: icon } ) : null,
            this._domLabel = el( 'span', [ this.get( 'label' ) ] )
        ]);
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
        }
    },

    // --- Keep state in sync with render ---

    _activateOnClick: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this.activate();
    }.on( 'click' ),

    _activateOnEnter: function ( event ) {
        if ( NS.DOMEvent.lookupKey( event ) === 'enter' ) {
            this.activate();
        }
    }.on( 'keydown' )
});

NS.ButtonView = ButtonView;

var MenuButtonView = NS.Class({

    Extends: ButtonView,

    type: 'MenuButtonView',

    popOverView: null,
    menuView: null,

    // --- Activate ---

    activate: function () {
        if ( !this.get( 'isActive' ) ) {
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

    _activateOnFocus: function () {
        if ( this.get( 'isFocussed' ) ) {
            this.activate();
        }
    }.observes( 'isFocussed' ),

    _activateOnMousedown: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) {
            return;
        }
        this.activate();
    }.on( 'mousedown' )
});

NS.MenuButtonView = MenuButtonView;

}( this.O ) );
