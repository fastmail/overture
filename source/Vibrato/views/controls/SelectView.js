// -------------------------------------------------------------------------- \\
// File: SelectView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, AbstractControlView.js                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {
    
var SelectView = NS.Class({
    
    Extends: NS.AbstractControlView,
    
    options: [],
    
    // --- Render ---
    
    className: 'SelectView',
    
    _render: function ( layer ) {
        var el = NS.Element.create;
        layer.appendChild(
            this._domLabel = el( 'span', { text: this.get( 'label' ) } )
        );
        layer.appendChild(
            this._domControl = this._renderSelect( this.get( 'options' ) )
        );
    },
    
    _renderSelect: function ( options ) {
        var selected = this.get( 'value' ),
            el = NS.Element.create,
            select = el( 'select', { disabled: this.get( 'disabled' ) },
                options.map( function ( option, i ) {
                    return el( 'option', {
                        text: option.text,
                        value: i,
                        selected: option.value === selected
                    });
                })
            );
        return select;
    },
    
    // --- Keep state in sync with render ---
    
    _syncSelected: function ( event ) {
        var i = this._domControl.selectedIndex;
        this.set( 'value', this.get( 'options' ).getObjectAt( i ).value );
    }.on( 'change' ),
    
    // --- Keep render in sync with state ---
    
    optionsDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            var select = this._renderSelect( this.get( 'options' ) );
            this.get( 'layer' ).replaceChild( select, this._domControl );
            this._domControl = select;
        }
    }.observes( 'options' ),
    
    updateLayer: function () {
        if ( this.get( 'isRendered' ) ) {
            var value = this.get( 'value' ),
                options = this.get( 'options' ),
                l = options.length;
            
            while ( l-- ) {
                if ( options[l].value === value ) {
                    this._domControl.value = l + '';
                    return;
                }
            }
        }
    }.observes( 'value' )
});

NS.SelectView = SelectView;

}( this.O ) );