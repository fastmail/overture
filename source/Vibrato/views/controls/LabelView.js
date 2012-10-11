// -------------------------------------------------------------------------- \\
// File: LabelView.js                                                         \\
// Module: View                                                               \\
// Requires: Core, View.js                                                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var LabelView = NS.Class({

    Extends: NS.View,

    layerTag: 'span',

    value: '',
    tooltip: '',

    draw: function ( layer ) {
        layer.title = this.get( 'tooltip' );
        layer.textContent = this.get( 'value' );
    },

    propertyNeedsRedraw: function () {
        return LabelView.parent
            .propertyNeedsRedraw.apply( this, arguments );
    }.observes( 'className', 'layerStyles', 'tooltip', 'value' ),

    redrawTooltip: function ( layer ) {
        layer.title = this.get( 'tooltip' );
    },

    redrawValue: function ( layer ) {
        layer.textContent = this.get( 'value' );
    }
});

NS.LabelView = LabelView;

}( this.O ) );
