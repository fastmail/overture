// -------------------------------------------------------------------------- \\
// File: ListItemView.js                                                      \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ListItemView = NS.Class({

    Extends: NS.View,

    content: null,

    index: 0,
    itemHeight: 32,

    selection: null,
    isSelected: false,

    init: function ( mixin ) {
        var selection = mixin.selection,
            content = mixin.content;
        if ( selection && content ) {
            this.isSelected = selection.isIdSelected(
                content.get( 'id' )
            );
        }
        ListItemView.parent.init.call( this, mixin );
    },

    positioning: 'absolute',

    layout: ( NS.UA.cssProps.transform3d ? function () {
        var index = this.get( 'index' ),
            itemHeight = this.get( 'itemHeight' );
        return {
            transform: 'translate3d(0,' + ( index * itemHeight ) + 'px,0)'
        };
    } : function () {
        var index = this.get( 'index' ),
            itemHeight = this.get( 'itemHeight' );
        return {
            top: index * itemHeight
        };
    }).property( 'index', 'itemHeight' )
});

NS.ListItemView = ListItemView;

}( this.O ) );
