// -------------------------------------------------------------------------- \\
// File: SelectionController.js                                               \\
// Module: Selection                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var SelectionController = NS.Class({

    Extends: NS.Object,

    content: null,

    init: function ( mixin ) {
        this._selectionId = 0;
        this._lastSelectedIndex = 0;
        this._selectedIds = {};

        this.isLoadingSelection = false;
        this.length = 0;

        SelectionController.parent.init.call( this, mixin );

        var content = this.get( 'content' );
        if ( content ) {
            content.on( 'query:updated', this, 'contentWasUpdated' );
        }
    },

    contentDidChange: function ( _, __, oldContent, newContent ) {
        if ( oldContent ) {
            oldContent.off( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( newContent ) {
            newContent.on( 'query:updated', this, 'contentWasUpdated' );
        }
        this.selectAll( false );
    }.observes( 'content' ),

    contentWasUpdated: function ( event ) {
        // If an id has been removed, it may no
        // longer belong to the selection
        var _selectedIds = this._selectedIds,
            length = this.get( 'length' ),
            removed = event.removed || [],
            added = event.added.reduce( function ( set, id ) {
                set[ id ] = true;
                return set;
            }, {} ),
            l = removed.length,
            id;

        while ( l-- ) {
            id = removed[l];
            if ( _selectedIds[ id ] && !added[ id ] ) {
                length -= 1;
                delete _selectedIds[ id ];
            }
        }

        this.set( 'length', length )
            .propertyDidChange( 'selectedIds' );
    },

    // ---

    selectedIds: function () {
        return Object.keys( this._selectedIds );
    }.property().nocache(),

    isIdSelected: function ( id ) {
        return !!this._selectedIds[ id ];
    },

    // ---

    selectIds: function ( ids, isSelected, _selectionId ) {
        if ( _selectionId && _selectionId !== this._selectionId ) {
            return;
        }
        // Make sure we've got a boolean
        isSelected = !!isSelected;

        var _selectedIds = this._selectedIds,
            howManyChanged = 0,
            l = ids.length,
            id, wasSelected;

        while ( l-- ) {
            id = ids[l];
            wasSelected = !!_selectedIds[ id ];
            if ( isSelected !== wasSelected ) {
                if ( isSelected ) {
                    _selectedIds[ id ] = true;
                }
                else {
                    delete _selectedIds[ id ];
                }
                howManyChanged += 1;
            }
        }

        if ( howManyChanged ) {
            this.increment( 'length',
                    isSelected ? howManyChanged : -howManyChanged )
                .propertyDidChange( 'selectedIds' );
        }

        this.set( 'isLoadingSelection', false );
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
            this.set( 'isLoadingSelection', true );
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
                this.set( 'isLoadingSelection', true );
            }
        }
        else {
            this._selectedIds = {};
            this.set( 'length', 0 )
                .propertyDidChange( 'selectedIds' )
                .set( 'isLoadingSelection', false );
        }

        return this;
    }
});

NS.SelectionController = SelectionController;

}( O ) );
