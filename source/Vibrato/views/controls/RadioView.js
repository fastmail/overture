// -------------------------------------------------------------------------- \\
// File: RadioView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var RadioView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    className: 'RadioView',

    draw: function ( layer ) {
        layer.appendChild(
            this._domControl = NS.Element.create( 'input', {
                type: 'radio',
                checked: this.get( 'value' )
            })
        );
        RadioView.parent.draw.call( this, layer );
    },

    // --- Keep render in sync with state ---

    propertyNeedsRedraw: function () {
        return RadioView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles',
        'isDisabled', 'label', 'tooltip', 'tabIndex',
        'value' ),

    redrawValue: function () {
        this._domControl.checked = this.get( 'value' );
    },

    // --- Keep state in sync with render ---

    activate: function () {
        this.set( 'value', true );
    }.on( 'click' )
});

NS.RadioView = RadioView;

}( this.O ) );
