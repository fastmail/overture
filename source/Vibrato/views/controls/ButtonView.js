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

    layerTag: 'button',

    icon: '',
    type: 'button',

    target: null,
    action: null,

    activate: function () {
        if ( !this.get( 'disabled' ) ) {
            var action = this.get( 'action' ),
                target = this.get( 'target' ) || this;
            if ( action ) {
                target.fire( action, { originView: this } );
            }
        }
    },

    // --- Render ---

    className: function () {
        var icon = this.get( 'icon' );
        return 'ButtonView ' + this.get( 'type' ) + ( icon ? ' ' + icon : '' );
    }.property( 'icon', 'type' ),

    _render: function ( layer ) {
        layer.disabled = this.get( 'disabled' );
        layer.title = this.get( 'tooltip' );
        layer.tabIndex = -1;

        var el = NS.Element.create;
        if ( this.get( 'icon' ) ) {
            layer.appendChild( el( 'i' ) );
        }
        layer.appendChild( this._domLabel = el( 'span', {
            text: this.get( 'label' )
        }) );
        this._domControl = layer;
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

}( this.O ) );
