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
        
    listView: null,

    selectionController: NS.bind( 'listView.selectionController' ),
    itemHeight: NS.bind( 'listView.itemHeight' ),

    index: 0,
    
    keys: {
        j: 'goNext',
        k: 'goPrev',
        x: 'select',
        'shift-x': 'select',
        o: 'trigger',
        enter: 'trigger'
    },
    
    className: 'ListViewKBWidgetView',
    positioning: 'absolute',
    layout: function () {
        var itemHeight = this.get( 'itemHeight' );
        return {
            top: itemHeight * this.get( 'index' ),
            height: itemHeight
        };
    }.property( 'itemHeight', 'index' ),
    
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
    
    go: function ( delta ) {
        this.increment( 'index', delta );
        if ( this.get( 'isInDocument' ) ) {
            var distance = this.get( 'distanceFromVisRect' );
            if ( distance ) {
                this.scrollIntoView( distance < 0 ? -0.6 : 0.6 );
            }
        }
    },
    goNext: function () {
        this.go( 1 );
    },
    goPrev: function () {
        this.go( -1 );
    },
    select: function ( event ) {
        var index = this.get( 'index' ),
            selectionController = this.get( 'selectionController' ),
            list = this.getFromPath( 'listView.content' ),
            record = list && list.getObjectAt( index );
        // Check it's next to a loaded record.
        if ( record ) {
            selectionController.selectIndex( index,
                !selectionController.isIdSelected( record.get( 'id' ) ),
                event.shiftKey );
        }
    },
    trigger: function () {}
});

NS.ListViewKBWidgetView = ListViewKBWidgetView;

}( O ) );