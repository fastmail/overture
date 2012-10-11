// -------------------------------------------------------------------------- \\
// File: TrueVisibleRect.js                                              \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

NS.TrueVisibleRect = {

    visibleRect: function () {
        // Ignore any changes whilst not in the DOM
        if ( !this.get( 'isInDocument' ) ) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        // Calculate current visible rect.
        var x = this.get( 'pxLeft' ),
            y = this.get( 'pxTop' ),
            width = this.get( 'pxWidth' ),
            height = this.get( 'pxHeight' ),
            parent = this.get( 'parentView' ).get( 'visibleRect' ),

            left = Math.max( x, parent.x ),
            right = Math.min( x + width, parent.x + parent.width ),
            top = Math.max( y, parent.y ),
            bottom = Math.min( y + height, parent.y + parent.height ),
            across = Math.max( right - left, 0 ),
            down = Math.max( bottom - top, 0 );

        return {
            x: left - x + this.get( 'scrollLeft' ),
            y: top - y + this.get( 'scrollTop' ),
            width: across,
            height: down
        };
    }.property( 'scrollTop', 'scrollLeft',
        'pxLayout', 'parentView.visibleRect', 'isInDocument' )
};

}( this.O ) );
