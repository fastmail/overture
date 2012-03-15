// -------------------------------------------------------------------------- \\
// File: ItemRenderer.js                                                      \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM                                            \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {
    
NS.ItemRenderer = NS.Class({

    itemHeight: 100,

    isSelected: false,

    isDirty: true,

    init: function ( content, view, index, context ) {
        if ( content ) {
            content.addObserverForKey( '*', this, 'contentDidChange' );
        }
        this.content = content;
        this.view = view;
        this.index = index;
        this.context = context;
    },

    destroy: function () {
        var content = this.content;
        if ( content ) {
            content.removeObserverForKey( '*', this, 'contentDidChange' );
        }
    },
    
    // If the index affects rendering, override this.
    setIndex: function ( index ) {
        this.index = index;
        this.layer._item_index = index;
    },

    // Can override these to redraw as necessary
    itemWasSelected: function () {
        if ( !this.isSelected ) {
            NS.Element.addClass( this.layer, 'selected' );
            this.isSelected = true;
        }
    },
    itemWasDeselected: function () {
        if ( this.isSelected ) {
            NS.Element.removeClass( this.layer, 'selected' );
            this.isSelected = false;
        }
    },

    contentDidChange: function () {
        this.isDirty = true;
        this.view.itemRenderIsDirty( this, this.context );
    },

    _render: function () {
        var div = document.createElement( 'div' );
        div.textContent = this.content || '';
        return div;
    },

    render: function () {
        if ( this.isDirty ) {
            this.layer = this._render();
            this.layer._item_index = this.index;
            this.isDirty = false;
        }
        return this.layer;
    }
});

}( O ) );