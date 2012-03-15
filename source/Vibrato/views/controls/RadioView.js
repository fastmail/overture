// -------------------------------------------------------------------------- \\
// File: RadioView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var RadioView = NS.Class({

    Extends: NS.AbstractControlView,

    // --- Render ---
    
    className: 'RadioView',

    _render: function ( layer ) {
        var el = NS.Element.create;
        layer.title = this.get( 'tooltip' );
        layer.appendChild(
            this._domControl = el( 'input', {
                type: 'radio',
                checked: this.get( 'value' )
            })
        );
        layer.appendChild( this._domLabel = el( 'span', {
            text: this.get( 'label' )
        }) );
    },

    // --- Keep state in sync with render ---
    
    activate: function () {
        this.set( 'value', true );
    }.on( 'click' ),
    
    // --- Keep render in sync with state ---

    updateLayer: function () {
        if ( this.get( 'isRendered' ) ) {
            this._domControl.checked = this.get( 'value' );
        }
    }.observes( 'value' )
});

NS.RadioView = RadioView;

}( O ) );