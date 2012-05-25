// -------------------------------------------------------------------------- \\
// File: ListViewKBWidgetView.js                                              \\
// Module: View                                                               \\
// Requires: View.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS, undefined ) {
 

var ListViewKBWidgetView = NS.Class({
    
    Extends: NS.View,
        
    className: 'ListViewKBWidgetView',
    layout: function () {
        var itemHeight = this.get( 'itemHeight' );
        return {
            top: itemHeight * this.get( 'index' ),
            height: itemHeight
        };
    }.property( 'itemHeight', 'index' ),
    
    listView: null,
    
    max: NS.bind( 'listView.contentLength' ),
    itemHeight: NS.bind( 'listView.itemHeight' ),
    selectionController: NS.bind( 'listView.selectionController' ),
    content: NS.bind( 'listView.content' ),
    
    _top: 0,
    
    index: 0,
    keys: {
        j: 'goNext',
        k: 'goPrev',
        x: 'select',
        'shift-x': 'select',
        o: 'trigger',
        enter: 'trigger'
    },
    
    init: function ( options ) {
        ListViewKBWidgetView.parent.init.call( this, options );
        var content = this.get( 'content' );
        if ( content ) {
            content.on( 'query:updated', this, 'contentWasUpdated' );
        }
    },
    
    destroy: function () {
        var content = this.get( 'content' );
        if ( content ) {
            content.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        ListViewKBWidgetView.parent.destroy.call( this );
    },
    
    contentDidChange: function ( _, __, oldVal, newVal ) {
        this.set( 'index', 0 );
        if ( oldVal ) {
            oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( newVal ) {
            newVal.on( 'query:updated', this, 'contentWasUpdated' );
        }
    }.observes( 'content' ),
    
    didAppendLayerToDocument: function () {
        var keys = this.get( 'keys' ),
            shortcuts = NS.RootViewController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.register( key, this, keys[ key ] );
        }
        if ( this.get( 'distanceFromVisRect' ) ) {
            this.scrollIntoView();
        }
        return ListViewKBWidgetView.parent
                .didAppendLayerToDocument.call( this );
    },
    willRemoveLayerFromDocument: function () {
        var keys = this.get( 'keys' ),
            shortcuts = NS.RootViewController.kbShortcuts,
            key;
        for ( key in keys ) {
            shortcuts.deregister( key, this, keys[ key ] );
        }
        return ListViewKBWidgetView.parent.
            willRemoveLayerFromDocument.call( this );
    },
    
    maxDidChange: function ( _, __, ___, max ) {
        if ( this.get( 'index' ) >= max ) {
            this.set( 'index', max - 1 );
        }
    }.observes( 'max' ),
    
    contentWasUpdated: function ( updates ) {
        var index = this.get( 'index' ),
            removed = updates.removedIndexes,
            added = updates.addedIndexes,
            l = removed.length,
            i;
        while ( l-- ) {
            if ( removed[l] < index ) { index -= 1; }
        }
        for ( i = 0, l = added.length; i < l; i += 1 ) {
            if ( added[i] <= index ) { index += 1; }
            // Guaranteed in ascending order.
            else { break; }
        }
        this.set( 'index', index.limit( 0, this.get( 'max' ) - 1 ) );
    },
    
    distanceFromVisRect: function () {
        var scrollView = this.getFromPath( 'listView.scrollView' );
        if ( scrollView ) {
            var scrollTop = scrollView.get( 'scrollTop' ),
                layout = this.get( 'layout' ),
                top = layout.top,
                above = top - scrollTop;
            
            if ( above < 0 ) { return above; }
            
            var scrollHeight = scrollView.get( 'pxHeight' ),
                below = top + layout.height - scrollTop - scrollHeight;
            
            if ( below > 0 ) { return below; }
        }
        return 0;
    }.property().nocache(),
    
    scrollIntoView: function ( offset ) {
        var scrollView = this.getFromPath( 'listView.scrollView' );
        if ( scrollView ) {
            var scrollHeight = scrollView.get( 'pxHeight' ),
                layout = this.get( 'layout' ),
                itemHeight = layout.height,
                top = layout.top;
            
            if ( offset && -1 <= offset && offset <= 1 ) {
                offset = ( offset * ( scrollHeight - itemHeight ) ) >> 1;
            }
            scrollView.scrollTo( 0,
                Math.max( 0,
                    top +
                    ( ( itemHeight - scrollHeight ) >> 1 ) +
                    ( offset || 0 )
                ),
                true
            );
        }
    },
    
    goNext: function () {
        this.go( this.get( 'index' ) + 1 );
    },
    goPrev: function () {
        this.go( this.get( 'index' ) - 1 );
    },
    go: function ( index ) {
        if ( 0 <= index && index < this.get( 'max' ) ) {
            this.set( 'index', index );
            // Check it's visible
            if ( this.get( 'isInDocument' ) ) {
                var distance = this.get( 'distanceFromVisRect' );
                if ( distance ) {
                    this.scrollIntoView( distance < 0 ? -0.6 : 0.6 );
                }
            }
        }
    },
    trigger: function () {},
    select: function ( event ) {
        var index = this.get( 'index' ),
            selectionController = this.get( 'selectionController' ),
            record = selectionController.get( 'content' ).getObjectAt( index );
        // Check it's next to a loaded record.
        if ( record ) {
            selectionController.selectIndex( index,
                !selectionController.isIdSelected( record.get( 'id' ) ),
                event.shiftKey );
        }
    }
});

NS.ListViewKBWidgetView = ListViewKBWidgetView;

}( O ) );