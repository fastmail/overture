// -------------------------------------------------------------------------- \\
// File: TrueVisibleRect.js                                                   \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Mixin: O.TrueVisibleRect

    The TrueVisibleRect mixin can be added to view classes to make the
    <O.View#visibleRect> property take into account clipping by the parent view.
    This is more expensive, so should only be used in classes where this is
    absolutely necessary, for example in <O.ProgressiveListView>, where it is
    used to only render the visible portion of a potentially very long list.
*/
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
