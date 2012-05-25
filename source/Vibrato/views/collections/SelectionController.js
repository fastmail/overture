// -------------------------------------------------------------------------- \\
// File: SelectionController.js                                               \\
// Module: View                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {

var SelectionController = O.Class({
    
    Extends: O.Object,
    
    view: null,
    content: O.bind( 'view.content' ),
    
    _selectionId: 0,
    _lastSelectedIndex: 0,
    
    init: function ( options ) {
        SelectionController.parent.init.call( this, options );
        var content = this.get( 'content' );
        if ( content ) {
            content.on( 'query:updated', this, 'contentWasUpdated' );
        }
        this._selectedIds = {};
    },
    
    contentDidChange: function ( _, __, oldContent, newContent ) {
        if ( oldContent ) {
            oldContent.detach( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( newContent ) {
            newContent.on( 'query:updated', this, 'contentWasUpdated' );
        }
        this._selectedIds = {};
        this.set( 'selectionLength', 0 )
            .propertyDidChange( 'selectedIds' );
    }.observes( 'content' ),
    
    contentWasUpdated: function ( event ) {
        // If an id has been removed, it may no
        // longer belong to the selection
        var selected = this._selectedIds,
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
            .propertyDidChange( 'selectedIds' );
    },
    
    // ---

    selectionLength: 0,
    
    selectedIds: function () {
        return Object.keys( this._selectedIds );
    }.property().nocache(),
    
    isIdSelected: function ( id ) {
        return !!this._selectedIds[ id ];
    },
    
    selectedIdsDidChange: function () {
        var itemViews = this.getFromPath( 'view.childViews' ),
            l = itemViews ? itemViews.length : 0;
        while ( l-- ) {
            itemViews[l].computedPropertyDidChange( 'isSelected' );
        }
    }.observes( 'selectedIds' ),
    
    // ---
    
    // Can override to provide feedback when waiting for ids to load.
    willLoadSelection: function ( show ) {},
    
    selectIds: function ( ids, isSelected, _selectionId, _start, _end ) {
        if ( _selectionId && _selectionId !== this._selectionId ) {
            return;
        }
        // Make sure we've got a boolean
        isSelected = !!isSelected;

        var selected = this._selectedIds,
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
            
        if ( howManyChanged ) {
            this.increment( 'selectionLength',
                    ( isSelected ? howManyChanged : -howManyChanged ) )
                .propertyDidChange( 'selectedIds' );
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
            this._selectedIds = {};
            this.set( 'selectionLength', 0 )
                .propertyDidChange( 'selectedIds' )
                .willLoadSelection( false );
        }
    
        return this;
    }
});

NS.SelectionController = SelectionController;

}( O ) );