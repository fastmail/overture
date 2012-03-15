// -------------------------------------------------------------------------- \\
// File: InfoBubbleView.js                                                    \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var InfoBubbleView = NS.Class({
    
    Extends: NS.View,

    className: function () {
        return 'InfoBubbleView ' + this.get( 'alignToThe' ) +
            ( this.get( 'isHidden' ) || !this.get( 'alignWithView' ) ?
                ' hidden' : '' );
    }.property( 'alignWithView', 'alignToThe', 'isHidden' ),
    
    zIndex: 5000,
    
    isHidden: true,
    alignWithView: null,
    alignToThe: 'top',
    text: '',
    
    init: function () {
        InfoBubbleView.parent.init.apply( this, arguments );
        this.get( 'rootView' ).insertView( this );
    },
    
    destroy: function () {
        this.get( 'rootView' ).removeView( this );
        InfoBubbleView.parent.destroy.call( this );
    },
    
    layout: function () {
        var view = this.get( 'alignWithView' );
        if ( !view ) { return {}; }
        
        var bounds = view.get( 'layer' ).getBoundingClientRect(),
            layout = {
                left: parseInt( bounds.left, 10 ),
                top: parseInt( bounds.top, 10 )
            },
            alignToThe = this.get( 'alignToThe' );
            
        if ( alignToThe === 'right' ) {
            // IE8 doesn't support bounds.width
            layout.left += parseInt( bounds.right - bounds.left, 10 );
        }
        else if ( alignToThe === 'bottom' ) {
            // IE8 doesn't support bounds.height
            layout.top += parseInt( bounds.bottom - bounds.top, 10 );
        }
        return layout;
    }.property( 'alignWithView', 'alignToThe' ),
    
    _render: function ( layer ) {
        var el = O.Element.create;
        layer.appendChild( el( 'span', [
            el( 'span', {
                text: O.bind( 'text', this )
            }),
            el( 'b' )
        ]) );
    }
});

NS.InfoBubbleView = InfoBubbleView;

}( O ) );