// -------------------------------------------------------------------------- \\
// File: CheckboxView.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var CheckboxView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---

    className: 'CheckboxView',

    _render: function ( layer ) {
        layer.appendChild(
            this._domControl = NS.Element.create( 'input', {
                type: 'checkbox',
                checked: this.get( 'value' )
            })
        );
        CheckboxView.parent._render.call( this, layer );
    },

    // --- Activate ---

    activate: function () {
        this.toggle( 'value' );
    },

    // --- Keep state in sync with render ---

    syncBackValue: function ( event ) {
        this.set( 'value', this._domControl.checked );
    }.on( 'change' ),

    // --- Keep render in sync with state ---

    syncValue: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.checked = this.get( 'value' );
        }
    }.observes( 'value' )
});

NS.CheckboxView = CheckboxView;

}( this.O ) );
