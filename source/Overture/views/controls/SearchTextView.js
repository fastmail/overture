// -------------------------------------------------------------------------- \\
// File: SearchTextView.js                                                    \\
// Module: ControlViews                                                       \\
// Requires: TextView.js                                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var SearchTextView = NS.Class({

    Extends: NS.TextView,

    type: 'v-SearchText',

    draw: function ( layer, Element, el ) {
        var children =
                SearchTextView.parent.draw.call( this, layer, Element, el );
        children.push(
            el( 'i.icon.icon-search' ),
            new NS.ButtonView({
                type: NS.bind( 'value', this, function ( value ) {
                    return value ? 'v-SearchText-reset iconOnly' : 'u-hidden';
                }),
                icon: 'icon-clear',
                positioning: 'absolute',
                label: NS.loc( 'Clear Search' ),
                target: this,
                method: 'reset'
            })
        );
        return children;
    },

    reset: function () {
        this.set( 'value', '' )
            .blur();
    }
});

NS.SearchTextView = SearchTextView;

}( this.O ) );
