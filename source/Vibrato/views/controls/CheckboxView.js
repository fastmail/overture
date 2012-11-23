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

    draw: function ( layer ) {
        layer.appendChild(
            this._domControl = NS.Element.create( 'input', {
                type: 'checkbox',
                checked: this.get( 'value' )
            })
        );
        CheckboxView.parent.draw.call( this, layer );
    },

    // --- Keep render in sync with state ---

    propertyNeedsRedraw: function () {
        return CheckboxView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles',
        'isDisabled', 'label', 'tooltip', 'tabIndex',
        'value' ),

    redrawValue: function () {
        this._domControl.checked = this.get( 'value' );
    },

    // --- Activate ---

    activate: function () {
        this.toggle( 'value' );
    },

    // --- Keep state in sync with render ---

    syncBackValue: function ( event ) {
        var isTap = ( event.type === 'tap' );
        // Ignore simulated click events
        if ( isTap || !event.originalType ) {
            var control = this._domControl,
                value = control.checked;
            if ( isTap ) {
                event.preventDefault();
                value = !value;
            }
            this.set( 'value', value );
        }
    }.on( 'click', 'tap' )
});

NS.CheckboxView = CheckboxView;

}( this.O ) );
