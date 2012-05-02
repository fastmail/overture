// -------------------------------------------------------------------------- \\
// File: PushSelectView.js                                                    \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM                                            \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS, undefined ) {
    
var PushSelectView = NS.Class({
    
    Extends: NS.View,
    
    options: [],
    
    // --- Render ---
        
    className: 'PushSelectView',
    
    _render: function ( layer ) {
        layer.appendChild( this._renderSelect() );
    },
    _renderSelect: function () {
        var el = NS.Element.create,
            selected = this.get( 'value' );
        
        return el( 'div',
            this.get( 'options' ).map( function ( option, i ) {
                return el( 'span', O.extend({
                    className: ( option.className || '' ) +
                        ( option.value === selected ? ' selected' : '' ),
                    'data-index': i
                }, option, true ) );
            })
        );
    },
    
    // --- Keep state in sync with render ---
    
    _selectOption: function ( event ) {
        var i = event.target.get( 'data-index' );
        if ( i != null ) {
            this.set( 'value', this.get( 'options' ).getObjectAt( i ).value );
        }
    }.on( 'click' ),
    
    // --- Keep render in sync with state ---
    
    optionsDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            var layer = this.get( 'layer' );
            layer.replaceChild( this._renderSelect(), layer.firstChild );
        }
    }.observes( 'options' ),
    
    updateLayer: function ( _, __, oldValue, newValue ) {
        if ( this.get( 'isRendered' ) ) {
            var Element = O.Element,
                childNodes = this.get( 'layer' ).firstChild.childNodes;
            this.get( 'options' ).forEach( function ( option, i ) {
                if ( option.value === oldValue ) {
                    Element.removeClass( childNodes[ i ], 'selected' );
                }
                if ( option.value === newValue ) {
                    Element.addClass( childNodes[ i ], 'selected' );
                }
            });
        }
    }.observes( 'value' )
});

NS.PushSelectView = PushSelectView;

}( O ) );