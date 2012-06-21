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

    activate: function () {
        this.toggle( 'value' );
    },

    // --- Render ---

    className: 'CheckboxView',

    _render: function ( layer ) {
        var el = NS.Element.create;
        layer.title = this.get( 'tooltip' );
        layer.appendChild(
            this._domControl = el( 'input', {
                type: 'checkbox',
                checked: this.get( 'value' )
            })
        );
        layer.appendChild( this._domLabel = el( 'span', {
            text: this.get( 'label' )
        }) );
    },

    // --- Keep state in sync with render ---

    _syncChecked: function ( event ) {
        this.set( 'value', this._domControl.checked );
    }.on( 'change' ),

    // --- Keep render in sync with state ---

    updateLayer: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.checked = this.get( 'value' );
        }
    }.observes( 'value' )
});

NS.CheckboxView = CheckboxView;

}( this.O ) );
