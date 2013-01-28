// -------------------------------------------------------------------------- \\
// File: Drag.js                                                              \\
// Module: View                                                               \\
// Requires: DragEffect.js                                                    \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

/* Issues with native drag and drop.

This system hooks into the native HTML5 drag and drop event system to allow data
to be dragged not just within the window but also between windows and other
applications/the OS itself. However, by default, all drags initiated within the
application will bypass this system and use a custom implementation, as the
native implementation (and indeed the spec) is extremely buggy. Problems (as of
13.05.11) include:

1. If an element is draggable, you cannot select text in any text input area
   underneath it.
2. Webkit sometimes repeatedly fires dragstart events rather than dragover
   events after the first dragstart. This has something to do with setDragImage,
   which also fails in some circumstances.
3. Webkit doesn't like a <canvas> element set as the drag image.
3. In webkit, drags initiated from image elements ignore setDragImage calls
   (http://www.alertdebugging.com/drag-and-drop-bugs/)
4. The spec is still changing from day to day, meaning the browser
   implementations are likely to change as well.
5. In Firefox, setDragImage only works with visible elements.

If you want to initiate a drag with data for an external app (e.g. a file download), you can still do this, by:

1. Setting a draggable="true" attribute on the HTML element to be dragged.
2. Either then setting the data as normal in the dragStarted method (if the view
   includes O.Draggable), or by handling the dragstart event. If the latter,
   you should set the following properties:

   event.dataTransfer.setData( type, data );
   event.dataTransfer.setDragImage( el, offsetX, offsetY );

Native support is turned on for drop targets though, as there are no
show-stopping bugs here, so this is handled as normal.

*/

// Inlined from O.DragEffect
var NONE = 0,
    COPY = 1,
    MOVE = 2,
    LINK = 4,
    ALL = COPY|MOVE|LINK,
    effectToString = NS.DragEffect.effectToString;

var Drag = NS.Class({

    Extends: NS.Object,

    nextEventTarget: NS.DragController,

    init: function ( options ) {
        Drag.parent.init.call( this, options );

        var event = options.event;
        this.cursorLocation = {
            x: event.clientX,
            y: event.clientY
        };
        if ( !options.startLocation ) {
            this.startLocation = this.cursorLocation;
        }
        this._setCursor( true );
        this.startDrag();
    },

    isNative: false,

    dragSource: null,
    allowedEffects: ALL,

    dataSource: null,

    dropTarget: null,
    dropEffect: MOVE,

    dragImage: null,
    dragImageOffset: function ( offset ) {
        if ( offset ) {
            if ( !this.isNative ) {
                offset.x = Math.max( offset.x, 5 );
                offset.y = Math.max( offset.y, 5 );
            }
            this._dragImageOffset = offset;
        }
        return this._dragImageOffset;
    }.property(),
    _dragImageOffset: { x: 5, y: 5 },

    cursorLocation: { x: 0, y: 0 },
    startLocation: { x: 0, y: 0 },

    // Drag image
    _dragImageDidChange: function ( _, __, oldImage, image ) {
        if ( this.isNative ) {
            var offset = this.get( 'dragImageOffset' );
            this.event.dataTransfer.setDragImage( image, offset.x, offset.y );
        } else {
            var dragCursor = this._dragCursor;
            if ( dragCursor ) {
                if ( oldImage ) {
                    dragCursor.removeChild( oldImage );
                }
            } else {
                dragCursor = this._dragCursor = NS.Element.create( 'div', {
                    style: 'position: fixed; z-index: 9999;'
                });
                this._updateDragImageLocation();
                document.body.appendChild( dragCursor );
            }
            dragCursor.appendChild( image );
        }
    }.observes( 'dragImage' ),
    _updateDragImageLocation: function () {
        var cursor, offset, dragImage;
        if ( this.isNative || !( dragImage = this._dragCursor ) ) { return; }
        cursor = this.get( 'cursorLocation' );
        offset = this.get( 'dragImageOffset' );
        dragImage.style.left = ( cursor.x + offset.x ) + 'px';
        dragImage.style.top = ( cursor.y + offset.y ) + 'px';
    }.queue( 'render' ).observes( 'cursorLocation', 'dragImageOffset' ),

    // Cursor type
    _setCursor: function ( set ) {
        var stylesheet = this._stylesheet,
            cursor = 'default';
        if ( stylesheet ) {
            stylesheet.parentNode.removeChild( stylesheet );
            stylesheet = null;
        }
        if ( set ) {
            switch ( this.get( 'dropEffect' ) ) {
                case NONE:
                    cursor = 'no-drop';
                    break;
                case COPY:
                    cursor = 'copy';
                    break;
                case LINK:
                    cursor = 'alias';
                    break;
            }

            stylesheet = NS.Stylesheet.create( 'o-drag-cursor',
                '*{cursor:default !important;cursor:' + cursor + ' !important;}'
            );
        }
        this._stylesheet = stylesheet;
    }.observes( 'dropEffect' ),

    // Data handlers:
    dataTypes: function () {
        var dataSource = this.get( 'dataSource' ) || this.get( 'dragSource' );
        if ( dataSource && dataSource.get( 'isDragDataSource' ) ) {
            return dataSource.get( 'dragDataTypes' );
        }
        if ( this.isNative ) {
            var dataTransfer = this.event.dataTransfer;
            // Current HTML5 DnD interface
            var items = dataTransfer.items,
                types = [],
                hasFiles = false,
                l;
            if ( items ) {
                l = items.length;
                while ( l-- ) {
                    if ( !hasFiles ) {
                        hasFiles = ( items[l].kind === 'file' );
                    }
                    types[l] = items[l].type;
                }
                if ( hasFiles ) {
                    types.push( 'Files' );
                }
                return types;
            }
            // Deprecated HTML5 DnD interface
            if ( dataTransfer.types ) {
                return Array.prototype.slice.call( dataTransfer.types );
            }
        }
        return [];
    }.property(),
    hasDataType: function ( type ) {
        return this.get( 'dataTypes' ).indexOf( type ) !== -1;
    },

    getFiles: function ( typeRegExp ) {
        var files = [],
            dataTransfer = this.event.dataTransfer,
            items, i, l, item;
        if ( dataTransfer ) {
            // Current HTML5 DnD interface
            if ( items = dataTransfer.items ) {
                for ( i = 0, l = items.length; i < l; i += 1 ) {
                    item = items[i];
                    if ( item.kind === 'file' &&
                            ( !typeRegExp || typeRegExp.test( item.type ) ) ) {
                        files.push( item.getAsFile() );
                    }
                }
            }
            // Deprecated HTML5 DnD interface
            else if ( items = dataTransfer.files ) {
                for ( i = 0, l = items.length; i < l; i += 1 ) {
                    item = items[i];
                    if ( !typeRegExp || typeRegExp.test( item.type ) ) {
                        files.push( item );
                    }
                }
            }
        }
        return files;
    },

    getDataOfType: function ( type, callback ) {
        var dataSource = this.get( 'dataSource' ) || this.get( 'dragSource' ),
            dataFound = false;
        if ( dataSource && dataSource.get( 'isDragDataSource' ) ) {
            callback( dataSource.getDragDataOfType( type, this ) );
            dataFound = true;
        }
        else if ( this.isNative ) {
            var dataTransfer = this.event.dataTransfer,
                items = dataTransfer.items,
                i, l, item;
            // Current HTML5 DnD interface
            if ( items ) {
                for ( i = 0, l = items.length; i < l; i += 1 ) {
                    item = items[i];
                    if ( item.type === type ) {
                        item.getAsString( callback );
                        dataFound = true;
                        break;
                    }
                }
            }
            // Deprecated HTML5 DnD interface
            else if ( dataTransfer.getData ) {
                callback( dataTransfer.getData( type ) );
                dataFound = true;
            }
        }
        if ( !dataFound ) {
            callback( null );
        }
        return this;
    },

    // General:
    startDrag: function () {
        NS.DragController.register( this );
        this.fire( 'dragStarted' );
        var dragSource = this.get( 'dragSource' ),
            allowedEffects, dataTransfer, dataSource, dataIsSet;
        // No drag source if drag started in another window/app.
        if ( dragSource ) {
            dragSource.set( 'isDragging', true ).dragStarted( this );

            allowedEffects = dragSource.get( 'allowedDragEffects' );
            this.set( 'allowedEffects', allowedEffects );

            // Native DnD support.
            if ( this.isNative ) {
                dataTransfer = this.event.dataTransfer;
                dataSource = this.get( 'dataSource' ) || dragSource;
                dataIsSet = false;

                dataTransfer.effectAllowed =
                    effectToString[ this.get( 'allowedEffects' ) ];

                if ( dataSource.get( 'isDragDataSource' ) ) {
                    dataSource.get( 'dragDataTypes' )
                              .forEach( function ( type ) {
                        if ( type.contains( '/' ) ) {
                            var data = dataSource.getDragDataOfType( type );
                            // Current HTML5 DnD interface
                            if ( dataTransfer.items ) {
                                dataTransfer.items.add( data, type );
                            }
                            // Deprecated HTML5 DnD interface
                            else if ( dataTransfer.setData ) {
                                dataTransfer.setData( type, data );
                            }
                            dataIsSet = true;
                        }
                    });
                }

                // Need something to keep the drag alive
                if ( !dataIsSet ) {
                    dataTransfer.setData( 'x-private', '' );
                }
            }
        }
        return this;
    },
    endDrag: function () {
        var dropTarget = this.get( 'dropTarget' ),
            dragSource = this.get( 'dragSource' );
        if ( dropTarget ) {
            dropTarget.dropExited( this );
        }
        if ( dragSource ) {
            dragSource.set( 'isDragging', false ).dragEnded( this );
        }

        if ( this._dragCursor ) {
            document.body.removeChild( this._dragCursor );
            this._dragCursor = null;
        }
        if ( this._scrollInterval ) {
            NS.RunLoop.cancel( this._scrollInterval );
            this._scrollInterval = null;
        }
        this._setCursor( false );

        this.fire( 'dragEnded' );
        NS.DragController.deregister( this );

        return this;
    },

    // Do the actual drag.
    move: function ( event ) {
        this.event = event;

        // Find which view is currently under the cursor. If none, presume we've
        // moved the cursor over the drag image, so we're probably still over
        // the current drop.
        var view = event.targetView,
            x, y;
        if ( !view ) {
            view = this.get( 'dropTarget' );
        }

        // Update cursor location
        this.set( 'cursorLocation', {
            x: x = event.clientX,
            y: y = event.clientY
        });

        // Check if we're over any hotspots that should trigger a scroll.
        this._check( view, x, y );

        // Recalculate drop target and update.
        this._update( view );

        return this;
    },

    _scrollBounds: null,
    _scrollView: null,
    _scrollBy: null,
    _scrollInterval: null,
    _lastTargetView: null,

    _check: function ( view, x, y ) {
        var scroll = this._scrollBounds,
            scrollView = this._scrollView,
            outsideTriggerRegionWidth = 15,
            bounds, deltaX, deltaY;

        // If we don't have any containing scroll container bounds, recalculate.
        if ( !scroll ||
                x < scroll.l || x > scroll.r || y < scroll.t || y > scroll.b ) {
            scroll = null;
            // Optimise by only reclaculating scrollView bounds when we mouse
            // over a new view.
            if ( view && this._lastTargetView !== view ) {
                this._lastTargetView = scrollView = view;

                if ( !( scrollView instanceof NS.ScrollView ) ) {
                    scrollView = scrollView.getParent( NS.ScrollView );
                }
                if ( scrollView ) {
                    bounds = scrollView.get( 'layer' ).getBoundingClientRect();
                    scroll = {
                        l: bounds.left - outsideTriggerRegionWidth,
                        r: bounds.right + outsideTriggerRegionWidth,
                        t: bounds.top - outsideTriggerRegionWidth,
                        b: bounds.bottom + outsideTriggerRegionWidth
                    };
                    // IE8 doesn't support bounds.(width|height)
                    deltaX = Math.min( 75, (bounds.right - bounds.left) >> 2 );
                    deltaY = Math.min( 75, (bounds.bottom - bounds.top) >> 2 );
                    scroll.hl = scroll.l + deltaX;
                    scroll.hr = scroll.r - deltaX;
                    scroll.ht = scroll.t + deltaY;
                    scroll.hb = scroll.b - deltaY;
                }
                this._scrollView = scrollView;
                this._scrollBounds = scroll;
            }
        }
        // Clear the timer if we used to be in a hotspot.
        if ( this._scrollInterval ) {
            NS.RunLoop.cancel( this._scrollInterval );
            this._scrollInterval = null;
        }
        // And set a new timer if we are currently in a hotspot.
        if ( scroll ) {
            deltaX = x < scroll.hl ? -10 : x > scroll.hr ? 10 : 0;
            deltaY = y < scroll.ht ? -10 : y > scroll.hb ? 10 : 0;
            if ( deltaX || deltaY ) {
                this._scrollBy = { x: deltaX, y: deltaY };
                this._scrollInterval =
                    NS.RunLoop.invokePeriodically( this._scroll, 100, this );
            }
        }
    },

    _scroll: function () {
        var scrollView = this._scrollView,
            scrollBy = this._scrollBy;

        if ( scrollView.scrollBy( scrollBy.x, scrollBy.y ) ) {
            var cursor = this.get( 'cursorLocation' ),
                target = document.elementFromPoint( cursor.x, cursor.y );
            if ( target ) {
                this._update( NS.RootViewController.getViewFromNode( target ) );
            }
        }
    },

    _update: function ( view ) {
        var currentDrop = this.get( 'dropTarget' ),
            dragSource = this.get( 'dragSource' );

        // Find the current drop Target
        while ( view ) {
            if ( view === currentDrop || (
                    view.get( 'isDropTarget' ) &&
                    view.willAcceptDrag( this ) ) ) {
                break;
            }
            view = view.get( 'parentView' ) || null;
        }

        // Update targets on status
        if ( view !== currentDrop ) {
            if ( currentDrop ) {
                currentDrop.dropExited( this );
            }
            if ( view ) {
                view.dropEntered( this );
            }
            currentDrop = view;
            this.set( 'dropTarget', view );
        }
        if ( currentDrop ) {
            currentDrop.dropMoved( this );
        }

        // Update source on status
        if ( dragSource ) {
            dragSource.dragMoved( this );
        }
    },

    // And drop
    drop: function ( event ) {
        this.event = event;
        if ( this.dropTarget && this.dropEffect ) {
            this.dropTarget.drop( this );
        }
        return this;
    }
});

NS.Drag = Drag;

}( this.O ) );
