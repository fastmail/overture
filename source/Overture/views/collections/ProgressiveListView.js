import { Class } from '../../core/Core';
import '../../foundation/ObservableProps';  // For Function#observes
import RunLoop from '../../foundation/RunLoop';  // Also Function#queue
import ScrollView from '../containers/ScrollView';
import ListView from './ListView';
import TrueVisibleRect from './TrueVisibleRect';

const ProgressiveListView = Class({

    Extends: ListView,

    Mixin: TrueVisibleRect,

    batchSize: 10,
    triggerInPx: 200,

    init (/* ...mixins */) {
        ProgressiveListView.parent.init.apply( this, arguments );
        this._renderRange.end = 0;
    },

    contentWasUpdated ( event ) {
        const scrollView = this.getParent( ScrollView );
        if ( scrollView ) {
            // Update scroll view correctly.
            const itemHeight = this.get( 'itemHeight' );
            const y = Math.max( this.get( 'visibleRect' ).y, 0 );
            // Index of first item rendered
            let top = ~~( y / itemHeight );
            const removedIndexes = event.removedIndexes;
            const addedIndexes = event.addedIndexes;
            const rendered = this._rendered;
            let change = 0;
            let i, l, id, view;

            // If we are within 3 items of the top, don't change anything.
            // The new items will push down the old so you will see the change.
            // Otherwise, adjust the scroll to make it appear as though it
            // hasn't changed when the new items are inserted above, so a flood
            // of items doesn't stop you from viewing a section of the list.
            if ( top > 2 ) {
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
                for ( id in rendered ) {
                    view = rendered[ id ];
                    view.set( 'animateLayer', false )
                        .set( 'index', view.get( 'index' ) + change )
                        .redraw()
                        .set( 'animateLayer', true );
                }
                scrollView.scrollBy( 0, change * itemHeight );
                scrollView.redraw();
            }
        }
        return ProgressiveListView.parent.contentWasUpdated.call( this, event );
    },

    _simulateScroll: function ( _, __, oldLength, length ) {
        // Convert null/undefined length to 0.
        if ( !length ) { length = 0; }
        // In IE or Opera, if the scrollTop of the containing overflowed div was
        // past the new maximum scrollTop, then although it correctly changes
        // to the new maximum scrollTop, no scroll event is fired. Therefore we
        // have to simulate this firing in the next event loop.
        if ( length < oldLength ) {
            RunLoop.invokeInNextEventLoop(
                this.fire.bind( this, 'scroll', null, null )
            );
        }
    }.observes( 'contentLength' ),

    visibleRectDidChange: function () {
        // We only care about changes when we're visible.
        if ( this.get( 'isInDocument' ) ) {
            const visible = this.get( 'visibleRect' );
            const extension = this.get( 'triggerInPx' );
            const batchSize = this.get( 'batchSize' );
            const height = this.get( 'itemHeight' ) * batchSize;
            const y = visible.y;
            // Index of first item we want rendered
            const start = Math.max( 0,
                    ~~( ( y - extension ) / height ) * batchSize );
            // Index of last item we want rendered
            const end = ~~( ( y + visible.height + extension ) / height ) *
                    batchSize + batchSize;
            const _renderRange = this._renderRange;

            if ( start !== _renderRange.start || end !== _renderRange.end ) {
                _renderRange.start = start;
                _renderRange.end = end;
                this.viewNeedsRedraw();
            }
        }
    }.queue( 'middle' ).observes( 'visibleRect', 'itemHeight' ),
});

export default ProgressiveListView;
