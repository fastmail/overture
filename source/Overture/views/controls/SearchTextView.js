// -------------------------------------------------------------------------- \\
// File: SearchTextView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: TextView.js                                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ClearSearchButtonView = new NS.Class({

    Extends: NS.ButtonView,

    type: 'v-ClearSearchButton',
    positioning: 'absolute',
    shortcut: 'ctrl-/'
});

NS.ClearSearchButtonView = ClearSearchButtonView;

var SearchTextView = NS.Class({

    Extends: NS.TextView,

    type: 'v-SearchText',

    icon: null,

    draw: function ( layer, Element, el ) {
        var children =
                SearchTextView.parent.draw.call( this, layer, Element, el );
        children.push(
            this.get( 'icon' ),
            Element.when( this, 'value' ).show([
                new NS.ClearSearchButtonView({
                    label: NS.loc( 'Clear Search' ),
                    target: this,
                    method: 'reset'
                })
            ]).end()
        );
        return children;
    },

    reset: function () {
        this.set( 'value', '' )
            .blur();
    }
});

NS.SearchTextView = SearchTextView;

}( O ) );
