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

    _render: function ( layer ) {
        layer.title = this.get( 'tooltip' );
        layer.textContent = this.get( 'value' );
    },

    redraw: function () {
        this._render( this.get( 'layer' ) );
    }.observes( 'value', 'tooltip' )
});

NS.LabelView = LabelView;

}( this.O ) );
