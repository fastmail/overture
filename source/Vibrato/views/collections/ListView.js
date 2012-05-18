// -------------------------------------------------------------------------- \\
// File: ListView.js                                                          \\
// Module: View                                                               \\
// Requires: View.js, TrueVisibleRect.js, ItemRenderer.js                     \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS, undefined ) {
    
var ListViewController = NS.Class({
    
    Extends: NS.Object,
    
    content: null,
    selectionLength: 0,
    
    _selectionId: 0,
    _lastSelectedIndex: 0,
    
    nextEventTarget: function () {
        return this.get( 'view' ).get( 'parentView' );
    }.property( 'view' ),
    
    init: function ( options ) {
        ListViewController.parent.init.call( this, options );
        this.selectedIds = {};
    },
    
    destroy: function () {
        var view = this.get( 'view' ),
            content = this.get( 'content' );
        if ( view && content ) {
            content.removeObserverForRange(
                view.get( 'renderedRange' ), this, 'contentRangeDidChange' );
            content.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        ListViewController.parent.destroy.call( this );
    },
    
    viewWasSet: function ( _, __, oldView, newView ) {
        var content = this.get( 'content' );
        if ( content ) {
            if ( oldView ) {
                content.removeObserverForRange(
                    oldView.get( 'renderedRange' ), this,
                    'contentRangeDidChange' );
            } else {
                content.on( 'query:updated', this, 'contentWasUpdated' );
            }
            if ( newView ) {
                content.addObserverForRange(
                    newView.get( 'renderedRange' ), this,
                    'contentRangeDidChange' );
            } else {
                content.detach( 'query:updated', this, 'contentWasUpdated' );
            }
        }
    }.observes( 'view' ),
    
    isIdSelected: function ( id ) {
        return !!this.get( 'selectedIds' )[ id ];
    },
    
    selected: function () {
        return Object.keys( this.get( 'selectedIds' ) );
    }.property().nocache(),
    
    // Can override to provide feedback when waiting for ids to load.
    willLoadSelection: function ( show ) {},
    
    selectIds: function ( ids, isSelected, _selectionId, _start, _end ) {
        if ( _selectionId && _selectionId !== this._selectionId ) {
            return;
        }
        var selected = this.get( 'selectedIds' ),
            selectionLength = this.get( 'selectionLength' ),
            howManyChanged = 0,
            l = ids.length,
            id, wasSelected;

        while ( l-- ) {
            id = ids[l];
            wasSelected = !!selected[ id ];
            if ( isSelected !== wasSelected ) {
                if ( isSelected ) {
                    selected[ id ] = true;
                }
                else {
                    delete selected[ id ];
                }
                howManyChanged += 1;
            }
        }

        this.get( 'view' ).setSelectionOnItemsInRange(
            _start || 0, _end || this.get( 'content' ).get( 'length' ) || 0 );
            
        this.set( 'selectionLength', selectionLength +
            ( isSelected ? howManyChanged : -howManyChanged ) );
            
        if ( howManyChanged ) {
            this.computedPropertyDidChange( 'selected' );
        }
        
        this.willLoadSelection( false );
    },

    selectIndex: function ( index, isSelected, includeRangeFromLastSelected ) {
        var lastSelectedIndex = this._lastSelectedIndex,
            start = includeRangeFromLastSelected ?
                Math.min( index, lastSelectedIndex ) : index,
            end = ( includeRangeFromLastSelected ?
                Math.max( index, lastSelectedIndex ) : index ) + 1;
        this._lastSelectedIndex = index;
        return this.selectRange( start, end, isSelected );
    },
    
    selectRange: function ( start, end, isSelected ) {
        // Make sure we've got a boolean
        isSelected = !!isSelected;
    
        var content = this.get( 'content' ),
            selectionId = ( this._selectionId += 1 ),
            loading = content.getIdsForObjectsInRange(
                start, end = Math.min( end, content.get( 'length' ) || 0 ),
                function ( ids, start, end ) {
                    this.selectIds( ids, isSelected, selectionId, start, end );
                }.bind( this )
            );
        
        if ( loading ) {
            this.willLoadSelection( true );
        }
        
        return this;
    },
    
    selectAll: function ( isSelected ) {
        var content = this.get( 'content' ),
            selectionId = ( this._selectionId += 1 );
            
        if ( isSelected ) {
            var loading = content.getIdsForAllObjects(
                function ( ids, start, end ) {
                    this.selectIds( ids, true, selectionId, start, end );
                }.bind( this )
            );
    
            if ( loading ) {
                this.willLoadSelection( true );
            }
        }
        else {
            this.set( 'selectedIds', {} );
            this.get( 'view' )
                .setSelectionOnItemsInRange( 0, content.get( 'length' ) );
            this.set( 'selectionLength', 0 )
                .computedPropertyDidChange( 'selected' );
            this.willLoadSelection( false );
        }
    
        return this;
    },
    
    contentWasUpdated: function ( event ) {
        // If an id has been removed, it may no
        // longer belong to the selection
        var selected = this.get( 'selectedIds' ),
            selectionLength = this.get( 'selectionLength' ),
            removed = event.removed || [],
            added = event.added.reduce( function ( set, id ) {
                set[ id ] = true;
                return set;
            }, {} ),
            l = removed.length,
            id;
        
        while ( l-- ) {
            id = removed[l];
            if ( selected[ id ] && !added[ id ] ) {
                selectionLength -= 1;
                delete selected[ id ];
            }
        }
        
        this.set( 'selectionLength', selectionLength )
            .computedPropertyDidChange( 'selected' );
        
        // Update scroll view correctly.
        var view = this.get( 'view' ),
            itemHeight = view.get( 'itemHeight' ),
            // Index of first item rendered
            top = ~~( view.get( 'visibleRect' ).y / itemHeight ),
            removedIndexes = event.removedIndexes,
            addedIndexes = event.addedIndexes,
            change = 0,
            i;
        
        if ( top < 3 && addedIndexes[0] < 3 ) {
            change = -( top + 1 );
        }
        else {
            for ( i = 0, l = removedIndexes.length; i < l; i += 1 ) {
                if ( removedIndexes[i] < top ) { change -= 1; }
            }
            top += change;
            for ( i = 0, l = addedIndexes.length; i < l; i += 1 ) {
                if ( addedIndexes[i] <= top ) { change += 1; }
                // Guaranteed in ascending order.
                else { break; }
            }
        }
        if ( change ) {
            view.get( 'scrollView' ).scrollBy( 0, change * itemHeight );
        }
    },
    
    contentDidChange: function ( _, key, oldVal, newVal ) {
        this._lastSelectedIndex = 0;
        this.set( 'selectedIds', {} )
            .set( 'selectionLength', 0 );
        
        var view = this.get( 'view' ),
            range = view && view.get( 'renderedRange' );
        if ( !view ) { return; }
        if ( oldVal ) {
            oldVal.removeObserverForRange(
                range, this, 'contentRangeDidChange' );
            oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( newVal ) {
            newVal.addObserverForRange(
                range, this, 'contentRangeDidChange' );
            newVal.on( 'query:updated', this, 'contentWasUpdated' );
        }
        view.set( 'content', newVal ).contentRangeDidChange( newVal, 0,
            Math.max(
                ( oldVal && oldVal.get( 'length' ) ) || 0,
                ( newVal && newVal.get( 'length' ) ) || 0
            )
        );
    }.observes( 'content' ),
    
    contentRangeDidChange: function ( data, start, end ) {
        this.get( 'view' ).contentRangeDidChange( data, start, end );
    },

    onClick: function ( event ) {
        if ( event.button || event.metaKey || event.ctrlKey ) { return; }
        var item = this.get( 'view' ).getItemFromEvent( event );
        if ( item ) {
            this.selectIndex( item.index, !item.isSelected, event.shiftKey );
        }
    }.on( 'click' )
});
    
var ListView = NS.Class({
    
    Extends: NS.View,
    
    Mixin: [ NS.TrueVisibleRect, NS.Draggable, NS.DragDataSource ],
    
    _nextWindowStart: 0,
    _nextWindowEnd: 0,
    _windowStart: 0,
    _windowEnd: 0,
    _windowSize: 10,
    _maxWindowEnd: 0,
    _triggerInPx: 200,
    
    controller: null,
    
    nextEventTarget: function () {
        return this.get( 'controller' );
    }.property( 'controller' ),
    
    selectedIds: function () {
        // Want to update immediately, so don't wait for bindings.
        return this.get( 'controller' ).get( 'selectedIds' );
    }.property().nocache(),
    
    content: null,
    contentLength: NS.bind( 'content.length' ),
    
    itemRenderer: NS.ItemRenderer,
    
    init: function ( options ) {
        ListView.parent.init.call( this, options );
        
        this._windows = {};
        
        var controller = this.get( 'controller' );
        
        this.set( 'itemHeight', this.itemRenderer.prototype.itemHeight )
            .set( 'renderedRange', { start: 0, end: 0 } )
            .set( 'content', controller.get( 'content' ) );
        
        controller.set( 'view', this );
        
        this._simulateScrollEvent =
            this.fire.bind( this, 'scroll', null, null );
    },
    
    destroy: function () {
        this.get( 'controller' ).destroy();
        var curWindowStart = this._windowStart,
            curWindowEnd = this._windowEnd,
            windows = this._windows;
        
        while ( curWindowStart < curWindowEnd ) {
            this.destroyWindow( windows[ curWindowStart ] );
            curWindowStart += 1;
        }
        ListView.parent.destroy.call( this );
    },
    
    awaken: function () {
        ListView.parent.awaken.call( this );
        if ( this._needsUpdate ) {
            this.updateLayer();
        }
    },
    
    scrollView: function () {
        var scrollView = this;
        do {
            scrollView = scrollView.get( 'parentView' );
        } while ( scrollView &&
            !( scrollView instanceof NS.ScrollView ) );
        return scrollView || null;
    }.property( 'parentView' ),
    
    createWindow: function ( i ) {
        var selected = this.get( 'selectedIds' ),
            windowSize = this._windowSize,
            windows = this._windows,
            win = windows[i] = {},
            ItemRenderer = this.get( 'itemRenderer' ),
            content = this.get( 'content' ),
            layer = win.layer = NS.Element.create( 'div', {
                styles: {
                    position: 'absolute',
                    top: i * windowSize * this.get( 'itemHeight' ),
                    left: 0,
                    width: '100%'
                }
            }),
            items = win.items = [],
            j = i * windowSize,
            l = Math.min( j + windowSize, this.get( 'contentLength' ) ),
            item, data;
            
        for ( ; j < l; j += 1 ) {
            data = content.getObjectAt( j );
            item = new ItemRenderer( data, this, j, i );
            item.isSelected = !!( data && selected[ data.get( 'id' ) ] );
            items.push( item );
            layer.appendChild( item.render() );
        }
        return layer;
    },
    
    updateWindow: function ( i ) {
        var selected = this.get( 'selectedIds' ),
            windowSize = this._windowSize,
            windows = this._windows,
            win = windows[i],
            ItemRenderer = this.get( 'itemRenderer' ),
            content = this.get( 'content' ),
            layer = win.layer = win.layer.cloneNode( false ),
            oldItems = win.items,
            oldItemsLength = oldItems.length,
            items = win.items = [],
            j = i * windowSize,
            l = Math.min( j + windowSize, this.get( 'contentLength' ) ),
            item, oldItem, data, k;
                
        for ( ; j < l; j += 1 ) {
            item = null;
            data = content.getObjectAt( j );
            for ( k = 0; k < oldItemsLength; k += 1 ) {
                oldItem = oldItems[k];
                if ( oldItem && oldItem.content === data ) {
                    item = oldItem;
                    item.setIndex( j );
                    oldItems[k] = null;
                    break;
                }
            }
            if ( !item ) {
                item = new ItemRenderer( data, this, j, i );
                item.isSelected = !!( data && selected[ data.get( 'id' ) ] );
            }
            items.push( item );
            layer.appendChild( item.render() );
        }
        for ( k = 0; k < oldItemsLength; k += 1 ) {
            if ( oldItems[k] ) {
                oldItems[k].destroy();
                oldItems[k] = null;
            }
        }
        win.isDirty = false;
        return layer;
    },
    
    destroyWindow: function ( i ) {
        var windows = this._windows,
            items = windows[i].items,
            l = items.length;
        
        while ( l-- ) {
            items[l].destroy();
        }
        
        delete windows[i];
    },
        
    itemRenderIsDirty: function ( renderer, index ) {
        this._windows[ index ].isDirty = true;
        this._redraw();
    },
    
    contentLengthDidChange: function ( _, __, oldLength, length ) {
        // Convert null/undefined length to 0.
        if ( !length ) { length = 0; }
        
        // Cache the maximum value windowEnd can now take.
        this._maxWindowEnd = length ?
            ~~( ( length - 1 ) / this._windowSize ) + 1 : 0;
        
        // Update height and notify
        this.get( 'layer' ).style.height =
            ( length * this.get( 'itemHeight' ) ) + 'px';
        this.computedPropertyDidChange( 'pxDimensions' );
        
        // In IE or Opera, if the scrollTop of the containing overflowed div was
        // past the new maximum scrollTop, then although it correctly changes
        // to the new maximum scrollTop, no scroll event is fired. Therefore we
        // have to simulate this firing in the next event loop.
        if ( length < oldLength ) {
            NS.RunLoop.invokeInNextEventLoop( this._simulateScrollEvent );
        }
    }.observes( 'contentLength' ),
    
    contentRangeDidChange: function ( data, start, end ) {
        if ( !this.get( 'isRendered' ) ) { return; }
        
        var windowSize = this._windowSize,
            windows = this._windows;
            
        start = Math.max( ~~( start / windowSize ), this._windowStart );
        end = Math.min( ~~( ( end - 1 ) / windowSize ) + 1, this._windowEnd );
        if ( start < end ) {
            for ( ; start < end; start += 1 ) {
                windows[ start ].isDirty = true;
            }
            this._redraw();
        }
    },
    
    visibleRectDidChange: function () {
        // We only care about changes when we're visible.
        if ( this.get( 'isInDocument' ) ) {
            var visible = this.get( 'visibleRect' ),
                itemHeight = this.get( 'itemHeight' ),
                extension = this._triggerInPx,
                y = visible.y,
                // Index of first item we want rendered
                start = ~~( ( y - extension ) / itemHeight ),
                // Index of last item we want rendered
                end = ~~( ( y + visible.height + extension ) / itemHeight ),
                windowSize = this._windowSize,
                windowStart = Math.max( 0, ~~( start / windowSize ) ),
                windowEnd =
                    Math.min( ~~( end / windowSize ) + 1, this._maxWindowEnd );
            if ( windowStart !== this._nextWindowStart ||
                    windowEnd !== this._nextWindowEnd ) {
                this._nextWindowStart = windowStart;
                this._nextWindowEnd = windowEnd;
                this._redraw();
            }
        }
    }.observes( 'visibleRect' ),
    
    _redraw: function () {
        if ( !this._isSleeping ) {
            NS.RunLoop.queueFn( 'after', this.updateLayer, this );
        } else {
            this._needsUpdate = true;
        }
    },

    updateLayer: function () {
        var newWindowStart = this._nextWindowStart,
            newWindowEnd = this._nextWindowEnd,
            curWindowStart = this._windowStart,
            curWindowEnd = this._windowEnd,
            windowSize = this._windowSize,
            windows = this._windows,
            range = this.get( 'renderedRange' ),
            layer = this.get( 'layer' ),
            frag = document.createDocumentFragment(),
            i;
        
        // Ensure windows in this new range are rendered
        // And update them if necessary
        for ( i = newWindowStart; i < newWindowEnd; i += 1 ) {
            if ( curWindowStart <= i && i < curWindowEnd ) {
                if ( windows[i].isDirty ) {
                    layer.removeChild( windows[i].layer );
                    frag.appendChild( this.updateWindow( i ) );
                }
            } else {
                frag.appendChild( this.createWindow( i ) );
            }
        }
        layer.appendChild( frag );
        
        // Destroy windows outside of the new range.
        for ( i = curWindowStart; i < curWindowEnd; i += 1 ) {
            if ( newWindowStart <= i && i < newWindowEnd ) {
                i = newWindowEnd - 1;
            } else {
                layer.removeChild( windows[i].layer );
                this.destroyWindow( i );
            }
        }
        
        // Set the observed range
        this._windowStart = newWindowStart;
        this._windowEnd = newWindowEnd;
        range.start = newWindowStart * windowSize;
        range.end = newWindowEnd * windowSize;
        
        this._needsUpdate = false;
    },

    _render: function ( layer ) {
        // Insert KB view if present:
        ListView.parent._render.call( this, layer );
        if ( this.get( 'content' ) ) {
            this.contentLengthDidChange( 0, 0, 0, this.get( 'contentLength' ) );
        }
    },
    
    setSelectionOnItemsInRange: function ( start, end ) {
        var windowSize = this._windowSize;
        
        start = Math.max( start, this._windowStart * windowSize );
        end = Math.min( end, this._windowEnd * windowSize );
        
        var selected = this.get( 'selectedIds' ),
            windows = this._windows,
            i = Math.floor( start / windowSize ),
            l = Math.floor( ( end - 1 ) / windowSize ) + 1,
            j = start % windowSize,
            k, items, item, content;
        
        for ( ; i < l; i += 1 ) {
            items = windows[i].items;
            k = items.length;
            while ( j < k && start < end ) {
                item = items[j];
                content = item.content;
                // Content could be null if this fires before updateWindow.
                // Ignore it if so; it will be rerendered anyway.
                if ( content ) {
                    if ( selected[ content.get( 'id' ) ] ) {
                        item.itemWasSelected();
                    } else {
                        item.itemWasDeselected();
                    }
                }
                start += 1;
                j += 1;
            }
            j = 0;
        }
        return this;
    },
    
    getItemAtIndex: function ( index ) {
        var windowSize = this._windowSize,
            window = this._windows[ ~~( index / windowSize ) ];
        return window ? window.items[ index % windowSize ] : null;
    },
    
    getItemFromEvent: function ( event ) {
        var node = event.target;
        while ( node && ( node._item_index === undefined  ) ) {
            node = node.parentNode;
        }
        return node ? this.getItemAtIndex( node._item_index ) : null;
    },
    
    // --- Child views not possible: just rendered list ---
    
    insertView: null,
    
    replaceView: null,

    removeView: null
});

var ListViewKBWidgetView = NS.Class({
    
    Extends: NS.View,
        
    className: 'ListViewKBWidgetView',
    layout: {},
    
    max: NS.bind( 'parentView.contentLength' ),
    itemHeight: NS.bind( 'parentView.itemHeight' ),
    controller: NS.bind( 'parentView.controller' ),
    content: NS.bind( 'parentView.content' ),
    scrollView: NS.bind( 'parentView.scrollView' ),
    
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
    
    _render: function ( layer ) {
        this.itemHeightDidChange();
    },
    
    itemHeightDidChange: function () {
        this.get( 'layer' ).style.height = this.get( 'itemHeight' ) + 'px';
    }.observes( 'itemHeight' ),
    
    contentDidChange: function ( _, __, oldVal, newVal ) {
        this.set( 'index', 0 );
        if ( oldVal ) {
            oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( newVal ) {
            newVal.on( 'query:updated', this, 'contentWasUpdated' );
        }
    }.observes( 'content' ),
    
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
    
    indexDidChange: function () {
        if ( this.get( 'isRendered' ) ) {
            // Move view
            var itemHeight = this.get( 'itemHeight' ),
                top = this._top = itemHeight * this.get( 'index' );
            this.get( 'layer' ).style.top = top + 'px';
        }
    }.observes( 'index' ),
    
    distanceFromVisRect: function () {
        var scrollView = this.get( 'scrollView' );
        if ( scrollView ) {
            var scrollTop = scrollView.get( 'scrollTop' ),
                top = this._top,
                above = top - scrollTop;
            
            if ( above < 0 ) { return above; }
            
            var scrollHeight = scrollView.get( 'pxHeight' ),
                height = this.get( 'itemHeight' ),
                below = top + height - scrollTop - scrollHeight;
            
            if ( below > 0 ) { return below; }
        }
        return 0;
    }.property().nocache(),
    
    scrollIntoView: function ( offset ) {
        var scrollView = this.get( 'scrollView' );
        if ( scrollView ) {
            var scrollHeight = scrollView.get( 'pxHeight' ),
                itemHeight = this.get( 'itemHeight' ),
                top = this._top;
            
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
            controller = this.get( 'controller' ),
            record = controller.get( 'content' ).getObjectAt( index );
        if ( record ) {
            controller.selectIndex( index,
                !controller.isIdSelected( record.get( 'id' ) ),
                event.shiftKey );
        }
    }
});

NS.ListViewController = ListViewController;
NS.ListView = ListView;
NS.ListViewKBWidgetView = ListViewKBWidgetView;

}( O ) );