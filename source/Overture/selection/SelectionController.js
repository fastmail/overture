// -------------------------------------------------------------------------- \\
// File: SelectionController.js                                               \\
// Module: Selection                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';
import Object from '../foundation/Object.js';
import '../foundation/ObservableProps.js';  // For Function#observes
import '../foundation/ComputedProps.js';  // For Function#property, #nocache

var SelectionController = Class({

    Extends: Object,

    content: null,

    init: function ( mixin ) {
        this._selectionId = 0;
        this._lastSelectedIndex = 0;
        this._selectedStoreKeys = {};

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
        this.selectNone();
    }.observes( 'content' ),

    contentWasUpdated: function ( event ) {
        // If an id has been removed, it may no
        // longer belong to the selection
        var _selectedStoreKeys = this._selectedStoreKeys;
        var length = this.get( 'length' );
        var removed = event.removed;
        var added = event.added.reduce( function ( set, storeKey ) {
            set[ storeKey ] = true;
            return set;
        }, {} );
        var l = removed.length;
        var storeKey;

        while ( l-- ) {
            storeKey = removed[l];
            if ( _selectedStoreKeys[ storeKey ] && !added[ storeKey ] ) {
                length -= 1;
                delete _selectedStoreKeys[ storeKey ];
            }
        }

        this.set( 'length', length )
            .propertyDidChange( 'selectedStoreKeys' );
    },

    // ---

    selectedStoreKeys: function () {
        return Object.keys( this._selectedStoreKeys );
    }.property().nocache(),

    isStoreKeySelected: function ( storeKey ) {
        return !!this._selectedStoreKeys[ storeKey ];
    },

    // ---

    selectStoreKeys: function ( storeKeys, isSelected, _selectionId ) {
        if ( _selectionId && _selectionId !== this._selectionId ) {
            return;
        }
        // Make sure we've got a boolean
        isSelected = !!isSelected;

        var _selectedStoreKeys = this._selectedStoreKeys;
        var howManyChanged = 0;
        var l = storeKeys.length;
        var storeKey, wasSelected;

        while ( l-- ) {
            storeKey = storeKeys[l];
            wasSelected = !!_selectedStoreKeys[ storeKey ];
            if ( isSelected !== wasSelected ) {
                if ( isSelected ) {
                    _selectedStoreKeys[ storeKey ] = true;
                }
                else {
                    delete _selectedStoreKeys[ storeKey ];
                }
                howManyChanged += 1;
            }
        }

        if ( howManyChanged ) {
            this.increment( 'length',
                    isSelected ? howManyChanged : -howManyChanged )
                .propertyDidChange( 'selectedStoreKeys' );
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
            loading = content.getStoreKeysForObjectsInRange(
                start, end = Math.min( end, content.get( 'length' ) || 0 ),
                function ( storeKeys, start, end ) {
                    this.selectStoreKeys( storeKeys,
                        isSelected, selectionId, start, end );
                }.bind( this )
            );

        if ( loading ) {
            this.set( 'isLoadingSelection', true );
        }

        return this;
    },

    selectAll: function () {
        var content = this.get( 'content' );
        var selectionId = ( this._selectionId += 1 );
        var loading = content.getStoreKeysForAllObjects(
            function ( storeKeys, start, end ) {
                this.selectStoreKeys( storeKeys,
                    true, selectionId, start, end );
            }.bind( this )
        );

        if ( loading ) {
            this.set( 'isLoadingSelection', true );
        }

        return this;
    },

    selectNone: function () {
        this._lastSelectedIndex = 0;
        this._selectedStoreKeys = {};
        this.set( 'length', 0 )
            .propertyDidChange( 'selectedStoreKeys' )
            .set( 'isLoadingSelection', false );

        return this;
    },
});

export default SelectionController;
