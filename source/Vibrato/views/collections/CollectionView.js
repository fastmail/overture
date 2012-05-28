// -------------------------------------------------------------------------- \\
// File: CollectionView.js                                                    \\
// Module: View                                                               \\
// Requires: Core, Foundation, DOM, View.js                                   \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {
    
var CollectionView = NS.Class({
    
    Extends: NS.View,
    
    itemView: NS.ItemView,
    
    _dirtyStart: -1,
    _dirtyEnd: -1,
    
    init: function ( options ) {
        this._observedRange = { start: 0 };
        this._renderedTotal = 0;
        this._managedViews = [];
        CollectionView.parent.init.call( this, options );
    },
    
    destroy: function () {
        if ( this.get( 'isRendered' ) ) {
            this.get( 'content' ).removeObserverForRange( this._observedRange,
                this, 'contentRangeDidChange' );
        }
        CollectionView.parent.destroy.call( this );
    },
    
    childViews: function () {
        return this._managedViews.filter( function ( view ) {
            return !!view;
        });
    }.property(),
    
    awaken: function () {
        CollectionView.parent.awaken.call( this );
        if ( this._dirtyStart < this._dirtyEnd ) {
            this.updateLayer();
        }
    },
    
    contentDidChange: function ( _, __, oldVal, newVal ) {
        if ( this.get( 'isRendered' ) ) {
            var range = this._observedRange;
            if ( oldVal ) {
                oldVal.removeObserverForRange(
                    range, this, 'contentRangeDidChange' );
            }
            if ( newVal ) {
                newVal.addObserverForRange(
                    range, this, 'contentRangeDidChange' );
            }
            this.contentRangeDidChange( newVal, 0,
                Math.max(
                    ( oldVal && oldVal.get( 'length' ) ) || 0,
                    ( newVal && newVal.get( 'length' ) ) || 0
                )
            );
        }
    }.observes( 'content' ),
    
    contentRangeDidChange: function ( _, start, end ) {
        this._dirtyStart = this._dirtyStart < 0 ?
            start : Math.min( start, this._dirtyStart );
        this._dirtyEnd = Math.max( end, this._dirtyEnd );
        if ( !this._isSleeping ) {
            NS.RunLoop.queueFn( 'after', this.updateLayer, this );
        }
    },
    
    _render: function ( layer ) {
        var content = this.get( 'content' );
        if ( content ) {
            this._dirtyStart = 0;
            this._dirtyEnd = content.get( 'length' ) || 0;
            this.updateLayer();
            content.addObserverForRange(
                this._observedRange, this, 'contentRangeDidChange' );
        }
    },
    
    isCorrectRender: function ( index, list, view ) {
        return list && ( list.getObjectAt( index ) === view.get( 'content' ) );
    },
    
    getViewAt: function ( index, list, collectionView, oldViews ) {
        var view = null,
            content = list.getObjectAt( index ),
            i, l;
        for ( i = 0, l = oldViews.length; i < l; i += 1 ) {
            if ( oldViews[i].get( 'content' ) === content ) {
                view = oldViews[i];
                oldViews.splice( i, 1 );
                view.set( 'index', index );
                break;
            }
        }
        return view || new ( this.get( 'itemView' ) )({
            parentView: collectionView,
            content: content,
            index: index
        });
    },
    
    willUpdateLayer: function ( start, end, _ ) {
        return [ start, end ];
    },
    didUpdateLayer: function ( start, end ) {},
    
    updateLayer: function () {
        var delegate = this.get( 'delegate' ) || this,
            
            list = this.get( 'content' ),
            length = ( list && list.get( 'length' ) ) || 0,
            
            range = delegate.willUpdateLayer(
                this._dirtyStart, this._dirtyEnd, list ),
            start = range[0],
            end = range[1],
            
            isInDocument = this.get( 'isInDocument' ),
            layer = this.get( 'layer' ),
            
            managedViews = this._managedViews,
            
            newViews = [],
            oldViews = [],
            frag = document.createDocumentFragment(),
            view, i, l;
        
        // Step 1. Remove existing views from DOM.
        for ( i = start, l = Math.min( end, this._renderedTotal );
                i < l; i += 1 ) {
            view = managedViews[i];
            if ( view ) {
                // Optimisation: check if the currently rendered view for this
                // index is already correct, and if so advance the start pointer
                // to the first incorrect view.
                if ( i === start &&
                        delegate.isCorrectRender( i, list, view ) ) {
                    start += 1;
                } else {
                    if ( isInDocument ) {
                        view.willRemoveLayerFromDocument();
                    }
                    managedViews[i] = null;
                    layer.removeChild( view.get( 'layer' ) );
                    oldViews.push( view );
                    if ( isInDocument ) {
                        view.didRemoveLayerFromDocument();
                    }
                }
            }
        }
        
        // Step 2. Create new ones.
        if ( list ) {
            for ( i = start, l = Math.min( end, length ); i < l; i += 1 ) {
                view = delegate.getViewAt( i, list, this, oldViews );
                if ( view ) {
                    newViews.push( view );
                    managedViews[i] = view;
                }
            }
        }
        
        // Step 3. Destroy anything not added back.
        l = oldViews.length;
        while ( l-- ) {
            oldViews[l].set( 'parentView', null ).destroy();
        }
        
        // Step 4. Let any observers know we've got new children.
        if ( start < end ) {
            this.computedPropertyDidChange( 'childViews' );
        }
        
        // Step 5. Render the new views
        for ( i = 0, l = newViews.length; i < l; i += 1 ) {
            view = newViews[i];
            frag.appendChild( view.render().get( 'layer' ) );
            if ( isInDocument ) {
                view.willAppendLayerToDocument();
            }
        }
        
        // Step 5. Insert the new views in the right place.
        if ( l ) {
            view = null;
            while ( end < length && !( view = managedViews[ end ] ) ) {
                end += 1;
            }
        
            if ( view ) {
                layer.insertBefore( frag, view.get( 'layer' ) );
            } else {
                layer.appendChild( frag );
            }
        }
        
        // Step 6. Inform the new views of their new status.
        if ( isInDocument ) {
            while ( l-- ) {
                newViews[l].didAppendLayerToDocument();
            }
        }
        
        // Step 7. Record our state.
        this._dirtyStart = this._dirtyEnd = -1;
        this._renderedTotal = length;
        
        delegate.didUpdateLayer( start, end );
    },
    
    // --- Can't add views by hand; just bound to content ---
    
    insertView: null,
    replaceView: null,
    removeView: null
});

NS.CollectionView = CollectionView;

}( O ) );