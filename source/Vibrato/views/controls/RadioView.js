// -------------------------------------------------------------------------- \\
// File: RadioView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var RadioView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    className: 'RadioView',

    _render: function ( layer ) {
        layer.appendChild(
            this._domControl = NS.Element.create( 'input', {
                type: 'radio',
                checked: this.get( 'value' )
            })
        );
        RadioView.parent._render.call( this, layer );
    },

    // --- Keep state in sync with render ---

    activate: function () {
        this.set( 'value', true );
    }.on( 'click' ),

    // --- Keep render in sync with state ---

    syncValue: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.checked = this.get( 'value' );
        }
    }.observes( 'value' )
});

NS.RadioView = RadioView;

}( this.O ) );
