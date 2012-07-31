// -------------------------------------------------------------------------- \\
// File: ScrollView.js                                                        \\
// Module: View                                                               \\
// Requires: Core, Foundation, View.js                                        \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ScrollAnimation = NS.Class({

    Extends: NS.Animation,

    duration: 250,

    prepare: function ( coordinates ) {
        var object = this.object,
            startX = this.startX = object.get( 'scrollLeft' ),
            startY = this.startY = object.get( 'scrollTop' ),
            endX = this.endX = coordinates.x || 0,
            endY = this.endY = coordinates.y || 0,
            deltaX = this.deltaX = endX - startX,
            deltaY = this.deltaY = endY - startY;

        return !!( deltaX || deltaY );
    },

    drawFrame: function ( position ) {
        var x = position < 1 ?
                this.startX + ( position * this.deltaX ) : this.endY,
            y = position < 1 ?
                this.startY + ( position * this.deltaY ) : this.endY;
        this.object.scrollTo( x, y );
    }
});

var ScrollView = NS.Class({

    Extends: NS.View,

    className: 'ScrollView',

    clipToBounds: true,
    showScrollbarY: true,

    positioning: 'absolute',
    layout: NS.View.LAYOUT_FILL_PARENT,

    keys: {},

    didAppendLayerToDocument: function () {
        // Scroll is reset to 0 some browsers whenever it is removed from the
        // DOM, so we need to set it to what it should be.
        var layer = this.get( 'layer' ),
            left = this.get( 'scrollLeft' ),
            top = this.get( 'scrollTop' );

        layer.scrollLeft = left;
        layer.scrollTop = top;
        layer.addEventListener( 'scroll', this, false );

        // Add keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.RootViewController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }

        return ScrollView.parent.didAppendLayerToDocument.call( this );
    },

    willRemoveLayerFromDocument: function () {
        // Remove keyboard shortcuts:
        var keys = this.get( 'keys' ),
            shortcuts = NS.RootViewController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.deregister( key, this, keys[ key ] );
        }

        this.get( 'layer' ).removeEventListener( 'scroll', this, false );

        return ScrollView.parent.willRemoveLayerFromDocument.call( this );
    },

    scrollAnimation: function ( ) {
        return new ScrollAnimation({
            object: this
        });
    }.property(),

    _onScroll: function ( event ) {
        var layer = this.get( 'layer' ),
            left = layer.scrollLeft,
            top = layer.scrollTop;
        this.beginPropertyChanges()
                .set( 'scrollLeft', left )
                .set( 'scrollTop', top )
            .endPropertyChanges();
        event.stopPropagation();
    }.on( 'scroll' ),

    scrollPage: function () {
        return this.scrollBy( 0, this.get( 'pxHeight' ) - 50, true );
    },
    reverseScrollPage: function () {
        return this.scrollBy( 0, 50 - this.get( 'pxHeight' ), true );
    },
    scrollLine: function () {
        return this.scrollBy( 0, 40 );
    },
    reverseScrollLine: function () {
        return this.scrollBy( 0, -40 );
    },

    scrollBy: function ( x, y, withAnimation ) {
        var left = this.get( 'scrollLeft' ),
            top = this.get( 'scrollTop' );
        x += left;
        y += top;

        this.scrollTo( x, y, withAnimation );

        return top !== this.get( 'scrollTop' ) ||
            left !== this.get( 'scrollLeft' );
    },

    scrollTo: function ( x, y, withAnimation ) {
        if ( withAnimation ) {
            this.get( 'scrollAnimation' ).animate({
                x: x,
                y: y
            });
            return this;
        }

        // Can't have negative scroll values.
        if ( x < 0 ) { x = 0; }
        if ( y < 0 ) { y = 0; }

        // Can only scroll when in the document; we'll scroll
        // on attachment anyway so just store the values otherwise.
        if ( this.get( 'isInDocument' ) ) {
            var layer = this.get( 'layer' );
            layer.scrollLeft = x;
            layer.scrollTop = y;
            // We don't know if they were greater than the max allowed value
            // (except if === 0).
            if ( x ) { x = layer.scrollLeft; }
            if ( y ) { y = layer.scrollTop; }
        }

        return this.beginPropertyChanges()
              .set( 'scrollLeft', x )
              .set( 'scrollTop', y )
            .endPropertyChanges();
    },

    scrollToView: function ( view, offset, withAnimation ) {
        var position = NS.Element.getPosition(
            view.get( 'layer' ), this.get( 'layer' ) );
        if ( !offset ) {
            offset = { x: 0, y: 0 };
        }
        return this.scrollTo(
            position.left + offset.x, position.top + offset.y, withAnimation );
    },

    visibleRect: function () {
        return {
            x: this.get( 'scrollLeft' ),
            y: this.get( 'scrollTop' ),
            width: this.get( 'pxWidth' ),
            height: this.get( 'pxHeight' )
        };
    }.property( 'pxDimensions', 'scrollLeft', 'scrollTop' )
});

NS.ScrollView = ScrollView;

}( this.O ) );
