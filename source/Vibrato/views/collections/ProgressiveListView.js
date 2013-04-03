// -------------------------------------------------------------------------- \\
// File: ProgressiveListView.js                                               \\
// Module: CollectionViews                                                    \\
// Requires: View, ListView.js, TrueVisibleRect.js                            \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var ListView = NS.Class({

    Extends: NS.ListView,

    Mixin: NS.TrueVisibleRect,

    renderInOrder: false,
    batchSize: 10,
    triggerInPx: 200,

    init: function ( mixin ) {
        ListView.parent.init.call( this, mixin );
        this._renderRange.end = 0;
    },

    contentWasUpdated: function ( event ) {
        var scrollView = this.getParent( NS.ScrollView );
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
        return ListView.parent.contentWasUpdated.call( this, event );
    },

    _simulateScroll: function ( _, __, oldLength, length ) {
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
                extension = this.get( 'triggerInPx' ),
                batchSize = this.get( 'batchSize' ),
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
    }.queue( 'middle' ).observes( 'visibleRect', 'itemHeight' )
});

NS.ProgressiveListView = ListView;

}( this.O ) );
