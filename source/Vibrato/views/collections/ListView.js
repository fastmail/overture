// -------------------------------------------------------------------------- \\
// File: ListView.js                                                          \\
// Module: View                                                               \\
// Requires: UnorderedCollectionView.js                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {

var ListView = NS.Class({
    
    Extends: NS.UnorderedCollectionView,
    
    Mixin: NS.TrueVisibleRect,
    
    _batchSize: 10,
    _triggerInPx: 200,
    itemHeight: 100,

    contentLength: NS.bind( 'content.length' ),
    
    init: function ( options ) {
        this._renderRange = { start: 0, end: 0 };
        ListView.parent.init.call( this, options );
    },
    
    positioning: 'absolute',

    layout: function () {
        return {
             top: 0,
             left: 0,
             right: 0,
             height: this.get( 'itemHeight' ) *
                 ( this.get( 'contentLength' ) || 0 )
        };
    }.property( 'itemHeight', 'contentLength' ),
 
    scrollView: function () {
        var scrollView = this;
        do {
            scrollView = scrollView.get( 'parentView' );
        } while ( scrollView &&
            !( scrollView instanceof NS.ScrollView ) );
        return scrollView || null;
    }.property( 'parentView' ),
 
    contentWasUpdated: function ( event ) {
        var scrollView = this.get( 'scrollView' );
        if ( scrollView ) {
            // Update scroll view correctly.
            var itemHeight = this.get( 'itemHeight' ),
                // Index of first item rendered
                top = ~~( this.get( 'visibleRect' ).y / itemHeight ),
                removedIndexes = event.removedIndexes,
                addedIndexes = event.addedIndexes,
                change = 0,
                i, l;
 
            if ( top < 3 && addedIndexes[0] < 3 ) {
                change = -( top + 1 );
            }
            else {
                for ( i = 0, l = removedIndexes.length; i < l; i += 1 ) {
                    if ( removedIndexes[i] < top ) { change -= 1; }
                    // Guaranteed in ascending order.
                    else { break; }
                }
                top += change;
                for ( i = 0, l = addedIndexes.length; i < l; i += 1 ) {
                    if ( addedIndexes[i] <= top ) { change += 1; }
                    // Guaranteed in ascending order.
                    else { break; }
                }
            }
            if ( change ) {
                scrollView.scrollBy( 0, change * itemHeight );
            }
        }
    },
    
    contentLengthDidChange: function ( _, __, oldLength, length ) {
        // Convert null/undefined length to 0.
        if ( !length ) { length = 0; }
        // In IE or Opera, if the scrollTop of the containing overflowed div was
        // past the new maximum scrollTop, then although it correctly changes
        // to the new maximum scrollTop, no scroll event is fired. Therefore we
        // have to simulate this firing in the next event loop.
        if ( length < oldLength ) {
            NS.RunLoop.invokeInNextEventLoop(
                this.fire.bind( this, 'scroll', null, null )
            );
        }
    }.observes( 'contentLength' ),
    
    visibleRectDidChange: function () {
        // We only care about changes when we're visible.
        if ( this.get( 'isInDocument' ) ) {
            var visible = this.get( 'visibleRect' ),
                extension = this._triggerInPx,
                batchSize = this._batchSize,
                height = this.get( 'itemHeight' ) * batchSize,
                y = visible.y,
                // Index of first item we want rendered
                start = Math.max( 0,
                    ~~( ( y - extension ) / height ) * batchSize ),
                // Index of last item we want rendered
                end = ~~( ( y + visible.height + extension ) / height ) *
                    batchSize + batchSize,
                _renderRange = this._renderRange;
            
            if ( start !== _renderRange.start || end !== _renderRange.end ) {
                _renderRange.start = start;
                _renderRange.end = end;
                this._redraw();
            }
        }
    }.observes( 'visibleRect' )
});

NS.ListView = ListView;

}( O ) );