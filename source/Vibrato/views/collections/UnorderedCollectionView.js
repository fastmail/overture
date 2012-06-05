// -------------------------------------------------------------------------- \\
// File: UnorderedCollectionView.js                                           \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {

var UnorderedCollectionView = NS.Class({
    
    Extends: NS.View,
    
    // Range in list to render.
    _renderRange: {
        start: 0,
        end: 0x7fffffff // Max positive signed 32bit int: 2^31 - 1
    },
    
    // Map id -> view instance
    _rendered: {},
    _needsUpdate: false,

    selectionController: null,
    content: null,
    itemView: null,
    
    childViews: function () {
        return Object.values( this._rendered );
    }.property(),
    
    init: function ( options ) {
        UnorderedCollectionView.parent.init.call( this, options );
        var selectionController = this.get( 'selectionController' );
        if ( selectionController ) {
            selectionController.set( 'view', this );
        }
    },
    
    destroy: function () {
        if ( this.get( 'isRendered' ) ) {
            var content = this.get( 'content' );
            if ( content ) {
                content.removeObserverForRange(
                    this._renderRange, this, '_redraw' );
                content.detach( 'query:updated', this, 'contentWasUpdated' );
            }
        }
        UnorderedCollectionView.parent.destroy.call( this );
    },

    awaken: function () {
        UnorderedCollectionView.parent.awaken.call( this );
        if ( this._needsUpdate ) {
            this.redraw();
        }
    },
    
    contentDidChange: function ( _, __, oldVal, newVal ) {
        if ( this.get( 'isRendered' ) ) {
            var range = this._renderRange;
            if ( oldVal ) {
                oldVal.removeObserverForRange( range, this, '_redraw' );
                oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
            }
            if ( newVal ) {
                newVal.addObserverForRange( range, this, '_redraw' );
                newVal.on( 'query:updated', this, 'contentWasUpdated' );
            }
            this._redraw();
        }
    }.observes( 'content' ),
    
    contentWasUpdated: function ( event ) {},
    
    _render: function ( layer ) {
        // Render any unmanaged child views first.
        UnorderedCollectionView.parent._render.call( this, layer );
        var content = this.get( 'content' );
        if ( content ) {
            content.addObserverForRange( this._renderRange, this, '_redraw' );
            content.on( 'query:updated', this, 'contentWasUpdated' );
            this.redraw();
        }
    },
    
    _redraw: function () {
        if ( !this._isSleeping ) {
            NS.RunLoop.queueFn( 'after', this.redraw, this );
        } else {
            this._needsUpdate = true;
        }
    },
    
    redraw: function () {
        var list = this.get( 'content' ) || [],
            ItemView = this.get( 'itemView' ),
            selectionController = this.get( 'selectionController' ),
            
            // Limit to this range in the content array.
            renderRange = this._renderRange,
            start = Math.max( 0, renderRange.start ),
            end = Math.min( list.get( 'length' ), renderRange.end ),
            
            // Set of already rendered views.
            rendered = this._rendered,
            newRendered = this._rendered = {},
            added = [],
            
            layer = this.get( 'layer' ),
            isInDocument = this.get( 'isInDocument' ),
            frag = layer.ownerDocument.createDocumentFragment(),
            i, l, item, id, view;
        
        // Get list to be rendered.
        for ( i = start, l = end; i < l; i += 1 ) {
            item = list.getObjectAt( i );
            id = item ? NS.guid( item ) : 'null:' + i;
            view = rendered[ id ];
            
            if ( view ) {
                view.set( 'index', i );
            } else {
                view = new ItemView({
                    parentView: this,
                    content: item,
                    index: i,
                    list: list,
                    selectionController: selectionController
                });
                if ( isInDocument ) {
                    view.willAppendLayerToDocument();
                    added.push( view );
                }
                frag.appendChild( view.render().get( 'layer' ) );
            }
            newRendered[ id ] = view;
        }
        
        // Remove ones which have gone.
        for ( id in rendered ) {
            if ( !newRendered[ id ] ) {
                view = rendered[ id ];
            
                if ( isInDocument ) {
                    view.willRemoveLayerFromDocument();
                }
                layer.removeChild( view.get( 'layer' ) );
                if ( isInDocument ) {
                    view.didRemoveLayerFromDocument();
                }
                view.set( 'parentView', null ).destroy();
            }
        }
        
        // Add new ones
        layer.appendChild( frag );
        for ( i = 0, l = added.length; i < l; i += 1 ) {
            added[i].didAppendLayerToDocument();
        }
        
        this.computedPropertyDidChange( 'childViews' );
        this._needsUpdate = false;
    },
    
    // --- Can't add views by hand; just bound to content ---
    
    insertView: null,
    replaceView: null,
    removeView: null
});

NS.UnorderedCollectionView = UnorderedCollectionView;

}( O ) );