// -------------------------------------------------------------------------- \\
// File: ListView.js                                                          \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class, guid } from '../../core/Core.js';
import { bind } from '../../foundation/Binding.js';
import '../../foundation/ComputedProps.js';  // For Function#property
import '../../foundation/ObservableProps.js';  // For Function#observes
import UA from '../../ua/UA.js';
import View from '../View.js';

var byIndex = function ( a, b ) {
    return a.get( 'index' ) - b.get( 'index' );
};

var addToTable = function ( array, table ) {
    var i, l;
    for ( i = 0, l = array.length; i < l; i += 1 ) {
        table[ array[i] ] = true;
    }
    return table;
};

var getNextViewIndex = function ( childViews, newRendered, fromIndex ) {
    var length = childViews.length;
    var view, item;
    while ( fromIndex < length ) {
        view = childViews[ fromIndex ];
        item = view.get( 'content' );
        if ( item && newRendered[ guid( item ) ] ) {
            break;
        }
        fromIndex += 1;
    }
    return fromIndex;
};

var ListView = Class({

    Extends: View,

    content: null,
    contentLength: bind( 'content.length' ),

    ItemView: null,
    itemHeight: 0,

    init: function ( mixin ) {
        this._added = null;
        this._removed = null;
        this._rendered = {};
        this._renderRange = {
            start: 0,
            end: 0x7fffffff // Max positive signed 32bit int: 2^31 - 1
        };

        this.selection = null;

        ListView.parent.init.call( this, mixin );

        var selection = this.get( 'selection' );
        if ( selection ) {
            selection.addObserverForKey(
                'selectedStoreKeys', this, 'redrawSelection' );
        }
    },

    destroy: function () {
        var selection = this.get( 'selection' );
        if ( selection ) {
            selection.removeObserverForKey(
                'selectedStoreKeys', this, 'redrawSelection' );
        }
        if ( this.get( 'isRendered' ) ) {
            var content = this.get( 'content' );
            if ( content ) {
                content.removeObserverForRange(
                    this._renderRange, this, 'viewNeedsRedraw' );
                content.off( 'query:updated', this, 'contentWasUpdated' );
            }
        }
        ListView.parent.destroy.call( this );
    },

    contentDidChange: function ( _, __, oldVal, newVal ) {
        if ( this.get( 'isRendered' ) ) {
            var range = this._renderRange;
            if ( oldVal ) {
                oldVal.removeObserverForRange( range, this, 'viewNeedsRedraw' );
                oldVal.off( 'query:updated', this, 'contentWasUpdated' );
            }
            if ( newVal ) {
                newVal.addObserverForRange( range, this, 'viewNeedsRedraw' );
                newVal.on( 'query:updated', this, 'contentWasUpdated' );
            }
            this.viewNeedsRedraw();
        }
    }.observes( 'content' ),

    contentWasUpdated: function ( event ) {
        if ( this.get( 'isInDocument' ) ) {
            this._added = addToTable( event.added, this._added || {} );
            this._removed = addToTable( event.removed, this._removed || {} );
        }
    },

    layout: function () {
        var itemHeight = this.get( 'itemHeight' );
        var height = itemHeight * ( this.get( 'contentLength' ) || 0 );
        // Firefox breaks in weird and wonderful ways when a scroll area is
        // over a certain height, somewhere between 2^24 and 2^25px tall.
        // 2^24 = 16,777,216
        if ( UA.firefox && height > 16777216 ) {
            height = 16777216;
        }
        return itemHeight ? {
            height: height
        } : {};
    }.property( 'itemHeight', 'contentLength' ),

    draw: function ( layer, Element/*, el*/ ) {
        // Render any unmanaged child views first.
        var children = ListView.parent.draw.call( this, layer ),
            content = this.get( 'content' );
        if ( children ) {
            Element.appendChildren( layer, children );
        }
        if ( content ) {
            content.addObserverForRange(
                this._renderRange, this, 'viewNeedsRedraw' );
            content.on( 'query:updated', this, 'contentWasUpdated' );
            this.redrawLayer( layer );
        }
    },

    viewNeedsRedraw: function () {
        this.propertyNeedsRedraw( this, 'layer' );
    },

    // -----------------------------------------------------------------------

    isCorrectItemView: function ( view, item ) {
        return view.get( 'content' ) === item;
    },

    createItemView: function ( content, index, list, isAdded ) {
        var ItemView = this.get( 'ItemView' );
        return new ItemView({
            parentView: this,
            content: content,
            index: index,
            list: list,
            isAdded: isAdded,
            selection: this.get( 'selection' )
        });
    },

    destroyItemView: function ( view ) {
        view.destroy();
    },

    redrawLayer: function ( layer ) {
        var list = this.get( 'content' ) || [];
        var childViews = this.get( 'childViews' );
        var isInDocument = this.get( 'isInDocument' );
        // Limit to this range in the content array.
        var renderRange = this._renderRange;
        var start = Math.max( 0, renderRange.start );
        var end = Math.min( list.get( 'length' ), renderRange.end );
        // Set of already rendered views.
        var rendered = this._rendered;
        var newRendered = this._rendered = {};
        // Are they new or always been there?
        var added = this._added;
        var removed = this._removed;
        // Bookkeeping
        var viewsDidEnterDoc = [];
        var frag = null;
        var currentViewIndex;
        var viewIsInCorrectPosition, i, l, item, id, view, isAdded, isRemoved;

        // Mark views we still need
        for ( i = start, l = end; i < l; i += 1 ) {
            item = list.getObjectAt( i );
            id = item ? guid( item ) : 'null:' + i;
            view = rendered[ id ];
            if ( view && this.isCorrectItemView( view, item, i ) ) {
                newRendered[ id ] = view;
            }
        }

        this.beginPropertyChanges();

        // Remove ones which are no longer needed
        for ( id in rendered ) {
            if ( !newRendered[ id ] ) {
                view = rendered[ id ];
                isRemoved = removed && ( item = view.get( 'content' ) ) ?
                    removed[ item.get( 'storeKey' ) ] : false;
                view.detach( isRemoved );
                this.destroyItemView( view );
            }
        }
        currentViewIndex = getNextViewIndex( childViews, newRendered, 0 );

        // Create/update views in render range
        for ( i = start, l = end; i < l; i += 1 ) {
            item = list.getObjectAt( i );
            id = item ? guid( item ) : 'null:' + i;
            view = newRendered[ id ];
            // Was the view already in the list?
            if ( view ) {
                // Is it in the correct position?
                viewIsInCorrectPosition =
                    childViews[ currentViewIndex ] === view;
                // If not, remove
                if ( !viewIsInCorrectPosition ) {
                    if ( isInDocument ) {
                        view.willLeaveDocument();
                    }
                    layer.removeChild( view.get( 'layer' ) );
                    if ( isInDocument ) {
                        view.didLeaveDocument();
                    }
                }
                // Always update list/index
                view.set( 'index', i )
                    .set( 'list', list );
                // If in correct position, all done
                if ( viewIsInCorrectPosition ) {
                    if ( frag ) {
                        layer.insertBefore( frag, view.get( 'layer' ) );
                        frag = null;
                    }
                    currentViewIndex =
                        getNextViewIndex(
                            childViews, newRendered, currentViewIndex + 1 );
                    continue;
                }
            } else {
                isAdded = added && item ?
                    added[ item.get( 'storeKey' ) ] : false;
                view = this.createItemView( item, i, list, isAdded );
                if ( !view ) {
                    continue;
                }
                newRendered[ id ] = view;
                childViews.push( view );
            }
            if ( !frag ) {
                frag = layer.ownerDocument.createDocumentFragment();
            }
            frag.appendChild( view.render().get( 'layer' ) );
            if ( isInDocument ) {
                view.willEnterDocument();
                viewsDidEnterDoc.push( view );
            }
        }
        if ( frag ) {
            layer.appendChild( frag );
        }
        if ( isInDocument && viewsDidEnterDoc.length ) {
            for ( i = 0, l = viewsDidEnterDoc.length; i < l; i += 1 ) {
                viewsDidEnterDoc[i].didEnterDocument();
            }
        }

        childViews.sort( byIndex );

        this._added = null;
        this._removed = null;
        this.propertyDidChange( 'childViews' );
        this.endPropertyChanges();
    },

    redrawSelection: function () {
        var selection = this.get( 'selection' ),
            itemViews = this.get( 'childViews' ),
            l = itemViews.length,
            view, storeKey;
        while ( l-- ) {
            view = itemViews[l];
            storeKey = view.getFromPath( 'content.storeKey' );
            if ( storeKey ) {
                view.set( 'isSelected',
                    selection.isStoreKeySelected( storeKey ) );
            }
        }
    },

    // --- Can't add views by hand; just bound to content ---

    insertView: null,
    replaceView: null
});

export default ListView;
