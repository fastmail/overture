// -------------------------------------------------------------------------- \\
// File: ListItemView.js                                                      \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ListItemView = NS.Class({

    Extends: NS.View,

    content: null,

    index: 0,
    itemHeight: 32,

    selectionController: null,
    isSelected: false,

    init: function ( mixin ) {
        var selectionController = mixin.selectionController,
            content = mixin.content;
        if ( selectionController && content ) {
            this.isSelected = selectionController.isIdSelected(
                content.get( 'id' )
            );
        }
        ListItemView.parent.init.call( this, mixin );
    },

    className: function () {
        return 'ListItemView' +
            ( this.get( 'isSelected' ) ? ' selected' : '' );
    }.property( 'isSelected' ),

    positioning: 'absolute',

    layout: function () {
        var index = this.get( 'index' ),
            itemHeight = this.get( 'itemHeight' );
        return  {
            top: index * itemHeight
        };
    }.property( 'index', 'itemHeight' ),

    detach: function ( wasRemovedFromList ) {
        var isInDocument = this.get( 'isInDocument' ),
            layer = this.get( 'layer' );
        if ( isInDocument ) {
            this.willRemoveLayerFromDocument();
        }
        layer.parentNode.removeChild( layer );
        if ( isInDocument ) {
            this.didRemoveLayerFromDocument();
        }
        this.set( 'parentView', null );
    }
});

NS.ListItemView = ListItemView;

}( this.O ) );