// -------------------------------------------------------------------------- \\
// File: SingleSelectionController.js                                         \\
// Module: Selection                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var SingleSelectionController = NS.Class({

    Extends: NS.Object,

    allowNoSelection: true,

    init: function ( mixin ) {
        this._ignore = false;

        this.content = null;
        this.record = null;
        this.index = -1;
        this.isFetchingIndex = false;

        SingleSelectionController.parent.init.call( this, mixin );

        var content = this.get( 'content' ),
            range = this._range = { start: -1, end: 0 };
        if ( content ) {
            content.addObserverForRange(
                range, this, 'recordAtIndexDidChange' );
            content.on( 'query:updated', this, 'contentWasUpdated' )
                   .on( 'query:reset', this, 'contentWasReset' );
        }
        if ( this.get( 'record' ) ) {
            this._recordDidChange();
        } else if ( this.get( 'index' ) > -1 ) {
            this._indexDidChange();
        } else if ( !this.get( 'allowNoSelection' ) ) {
            this.set( 'index', 0 );
        }
    },

    destroy: function () {
        var content = this.get( 'content' );
        if ( content ) {
            content.off( 'query:reset', this, 'contentWasReset' )
                   .off( 'query:updated', this, 'contentWasUpdated' );
            content.removeObserverForRange(
                this._range, this, 'recordAtIndexDidChange' );
        }
        SingleSelectionController.parent.destroy.call( this );
    },

    recordAtIndexDidChange: function () {
        if ( !this.get( 'record' ) ) {
            var content = this.get( 'content' );
            this.set( 'record', content &&
                content.getObjectAt( this.get( 'index' ) ) ||
                null
            );
        }
    }.queue( 'before' ),

    _indexDidChange: function () {
        var list = this.get( 'content' ),
            length = list ? list.get( 'length' ) : 0,
            index = this.get( 'index' ),
            range = this._range,
            record;
        range.start = index;
        range.end = index + 1;
        if ( !this._ignore ) {
            if ( ( index < 0 && !this.get( 'allowNoSelection' ) ) ||
                    ( !length && index > 0 ) ) {
                this.set( 'index', 0 );
            } else if ( length > 0 && index >= length ) {
                this.set( 'index', length - 1 );
            } else {
                if ( length && index > -1 ) {
                    record = list.getObjectAt( index );
                }
                this._ignore = true;
                this.set( 'record', record || null );
                this._ignore = false;
            }
        }
    }.observes( 'index' ),

    _recordDidChange: function () {
        if ( !this._ignore ) {
            var record = this.get( 'record' ),
                list = this.get( 'content' );
            if ( record && list ) {
                this.set( 'isFetchingIndex', true );
                list.indexOfId( record.get( 'id' ), 0, function ( index ) {
                    if ( this.get( 'record' ) === record &&
                            this.get( 'content' ) === list ) {
                        this._ignore = true;
                        this.set( 'index', index );
                        this._ignore = false;
                        this.set( 'isFetchingIndex', false );
                    }
                }.bind( this ) );
            } else if ( record || this.get( 'allowNoSelection' ) ) {
                this._ignore = true;
                this.set( 'index', -1 );
                this._ignore = false;
            }
        }
    }.observes( 'record' ),

    contentDidChange: function ( _, __, oldVal, newVal ) {
        var range = this._range,
            allowNoSelection = this.get( 'allowNoSelection' ),
            record = this.get( 'record' ),
            index = allowNoSelection ? -1 : 0;

        if ( oldVal ) {
            oldVal.off( 'query:reset', this, 'contentWasReset' )
                  .off( 'query:updated', this, 'contentWasUpdated' );
            oldVal.removeObserverForRange(
                range, this, 'recordAtIndexDidChange' );
        }
        if ( newVal ) {
            newVal.addObserverForRange( range, this, 'recordAtIndexDidChange' );
            newVal.on( 'query:updated', this, 'contentWasUpdated' )
                  .on( 'query:reset', this, 'contentWasReset' );
        }

        if ( record && newVal ) {
            index = newVal.indexOfId( record.get( 'id' ) );
            if ( !allowNoSelection && index < 0 ) {
                index = 0;
            }
        }

        if ( index === this.get( 'index' ) ) {
            record = newVal && newVal.getObjectAt( index );
            this.set( 'record', record || null );
        } else {
            this.set( 'index', index );
        }
    }.observes( 'content' ),

    contentWasUpdated: function ( updates ) {
        var record = this.get( 'record' ),
            index = record ? updates.added.indexOf( record.get( 'id' ) ) : -1,
            removedIndexes = updates.removedIndexes,
            addedIndexes = updates.addedIndexes,
            content = this.get( 'content' ),
            change = 0,
            i, l;

        // No current record, no update of position required.
        if ( !record ) {
            return;
        }

        if ( index > -1 ) {
            index = addedIndexes[ index ];
        } else {
            index = this.get( 'index' );
            // Can't update a position not currently in the list.
            if ( index === -1 ) {
                return;
            }
            for ( i = 0, l = removedIndexes.length; i < l; i += 1 ) {
                if ( removedIndexes[i] < index ) { change += 1; }
                // Guaranteed in ascending order.
                else { break; }
            }
            index -= change;
            for ( i = 0, l = addedIndexes.length; i < l; i += 1 ) {
                if ( addedIndexes[i] <= index ) { index += 1; }
                // Guaranteed in ascending order.
                else { break; }
            }
        }
        index = Math.min( index,
            ( ( content && content.get( 'length' ) ) || 1 ) - 1 );
        if ( index === this.get( 'index' ) ) {
            record = content && content.getObjectAt( index );
            this.set( 'record', record || null );
        } else {
            this.set( 'index', index );
        }
    },

    contentWasReset: function () {
        this._recordDidChange();
    }
});

NS.SingleSelectionController = SingleSelectionController;

}( this.O ) );
