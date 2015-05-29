// -------------------------------------------------------------------------- \\
// File: SingleSelectionController.js                                         \\
// Module: Selection                                                          \\
// Requires: Core, Foundation, DataStore                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var READY = NS.Status.READY;

var SingleSelectionController = NS.Class({

    Extends: NS.Object,

    allowNoSelection: true,

    init: function ( mixin ) {
        this._ignore = false;
        this._range = { start: -1, end: 0 };

        this.content = null;
        this.record = null;
        this.index = -1;
        this.isFetchingIndex = false;

        SingleSelectionController.parent.init.call( this, mixin );

        var content = this.get( 'content' );
        if ( content ) {
            this.contentDidChange( null, '', null, content );
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
            // If both content and record are bound, content *must* be synced
            // first in order to look for the new record in the new list.
            // If changed, return as the new record will be handled by the
            // setRecordInNewContent fn.
            var binding = NS.meta( this ).bindings.content;
            if ( binding ) {
                this._ignore = true;
                binding.sync();
                this._ignore = false;
            }
            if ( record && list ) {
                this.set( 'isFetchingIndex', true );
                list.indexOfId(
                    record.toIdOrStoreKey(),
                    0,
                    function ( index ) {
                        if ( this.get( 'record' ) === record &&
                                this.get( 'content' ) === list ) {
                            this._ignore = true;
                            this.set( 'index', index );
                            this._ignore = false;
                            this.set( 'isFetchingIndex', false );
                        }
                    }.bind( this )
                );
            } else if ( record || this.get( 'allowNoSelection' ) ) {
                this._ignore = true;
                this.set( 'index', -1 );
                this._ignore = false;
            }
        }
    }.observes( 'record' ),

    setRecordInNewContent: function ( list ) {
        // If fetching an explicit index, we've already set the explicit
        // record we want; don't change it.
        if ( this.get( 'isFetchingIndex' ) ) {
            return;
        }
        // If we're about to sync a new record, nothing to do
        var binding = NS.meta( this ).bindings.record;
        if ( binding && binding.isNotInSync && binding.willSyncForward ) {
            return;
        }

        var allowNoSelection = this.get( 'allowNoSelection' ),
            record = this.get( 'record' ),
            index = allowNoSelection ? -1 : 0;

        // Race condition check: has the content property changed since the
        // SingleSelectionController#contentBecameReady call?
        if ( list !== this.get( 'content' ) ) {
            return;
        }

        // See if the currently set record exists in the new list. If it does,
        // we'll use that.
        if ( record ) {
            index = list.indexOfId( record.toIdOrStoreKey() );
            if ( !allowNoSelection && index < 0 ) {
                index = 0;
            }
        }

        if ( index === this.get( 'index' ) ) {
            record = list.getObjectAt( index );
            this.set( 'record', record || null );
        } else {
            this.set( 'index', index );
        }
    },

    contentDidChange: function ( _, __, oldVal, newVal ) {
        var range = this._range;
        if ( oldVal ) {
            oldVal.off( 'query:reset', this, 'contentWasReset' )
                  .off( 'query:updated', this, 'contentWasUpdated' );
            oldVal.removeObserverForRange(
                range, this, 'recordAtIndexDidChange' );
            oldVal.removeObserverForKey( 'status', this, 'contentBecameReady' );
        }
        if ( newVal ) {
            newVal.addObserverForRange( range, this, 'recordAtIndexDidChange' );
            newVal.on( 'query:updated', this, 'contentWasUpdated' )
                  .on( 'query:reset', this, 'contentWasReset' );
            this.set( 'isFetchingIndex', false );
            // If we're already setting the record, nothing to do.
            if ( !this._ignore ) {
                if ( newVal.is( READY ) ) {
                    this.setRecordInNewContent( newVal );
                } else {
                    newVal.addObserverForKey(
                        'status', this, 'contentBecameReady' );
                }
            }
        }
    }.observes( 'content' ),

    contentBecameReady: function ( list, key ) {
        if ( list.is( READY ) ) {
            list.removeObserverForKey( key, this, 'contentBecameReady' );
            // Queue so that all data from the server will have been loaded
            // into the list.
            NS.RunLoop.queueFn( 'before',
                this.setRecordInNewContent.bind( this, list ) );
        }
    },

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

}( O ) );
