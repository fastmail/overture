// -------------------------------------------------------------------------- \\
// File: SingleSelectionController.js                                         \\
// Module: View                                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

( function ( NS ) {

var SingleSelectionController = NS.Class({
    
    Extends: NS.Object,
    
    init: function ( options ) {
        SingleSelectionController.parent.init.call( this, options );
        var content = this.get( 'content' ),
            range = this._range = { start: -1, end: 0 };
        if ( content ) {
            content.addObserverForRange( range, this, 'idAtIndexDidChange' );
            content.on( 'query:updated', this, 'contentWasUpdated' );
        }
        if ( this.get( 'id' ) ) {
            this._idDidChange();
        } else if ( this.get( 'index' ) > -1 ) {
            this._indexDidChange();
        } else {
            this.set( 'index', 0 );
        }
    },
    
    destroy: function () {
        var content = this.get( 'content' );
        if ( content ) {
            content.detach( 'query:updated', this, 'contentWasUpdated' );
            content.removeObserverForRange(
                this._range, this, 'idAtIndexDidChange' );
        }
        SingleSelectionController.parent.destroy.call( this );
    },

    content: null,
    
    id: null,
    index: -1,
    
    _ignore: false,
    
    idAtIndexDidChange: function () {
        var record = this.get( 'content' ).getObjectAt( this.get( 'index' ) );
        if ( !this.get( 'id' ) ) {
            this.set( 'id', record ? record.get( 'id' ) : null );
        }
    },
    
    _indexDidChange: function () {
        var list = this.get( 'content' ),
            length = list ? list.get( 'length' ) : 0,
            index = this.get( 'index' ),
            range = this._range,
            id = null,
            record;
        range.start = index;
        range.end = index + 1;
        if ( !this._ignore ) {
            if ( index < 0 || ( !length && index ) ) {
                this.set( 'index', 0 );
            } else if ( length && index >= length ) {
                this.set( 'index', length - 1 );
            } else {
                if ( length && index > -1 ) {
                    record = list.getObjectAt( index );
                    if ( record ) { id = record.get( 'id' ); }
                }
                this._ignore = true;
                this.set( 'id', id );
                this._ignore = false;
            }
        }
    }.observes( 'index' ),
    
    _idDidChange: function () {
        var id = this.get( 'id' ),
            list = this.get( 'content' );
        if ( id && !this._ignore ) {
            if ( list ) {
                list.indexOfId( id, 0, function ( index ) {
                    if ( this.get( 'id' ) === id ) {
                        this._ignore = true;
                        this.set( 'index', index );
                        this._ignore = false;
                    }
                }.bind( this ) );
            } else {
                this._ignore = true;
                this.set( 'index', -1 );
                this._ignore = false;
            }
        }
    }.observes( 'id' ),
    
    contentDidChange: function ( _, __, oldVal, newVal ) {
        var range = this._range;
        if ( oldVal ) {
            oldVal.detach( 'query:updated', this, 'contentWasUpdated' );
            oldVal.removeObserverForRange( range, this, 'idAtIndexDidChange' );
        }
        if ( newVal ) {
            newVal.addObserverForRange( range, this, 'idAtIndexDidChange' );
            newVal.on( 'query:updated', this, 'contentWasUpdated' );
        }
        var id = this.get( 'id' ),
            index;
        if ( id ) {
            index = newVal.indexOfId( id );
        }
        this.set( 'index', index > -1 ? index : 0 );
    }.observes( 'content' ),
    
    contentWasUpdated: function ( updates ) {
        var index = updates.added.indexOf( this.get( 'id' ) ),
            removedIndexes = updates.removedIndexes,
            addedIndexes = updates.addedIndexes,
            change = 0,
            i, l;
        
        if ( index > -1 ) {
            index = addedIndexes[ index ];
        } else {
            index = this.get( 'index' );
            for ( i = 0, l = removedIndexes.length; i < l; i += 1 ) {
                if ( removedIndexes[i] < index ) { change += 1; }
                // Guaranteed in ascending order.
                else { break; }
            }
            index -= change;
            change = 0;
            for ( i = 0, l = addedIndexes.length; i < l; i += 1 ) {
                if ( addedIndexes[i] <= index ) { change += 1; }
                // Guaranteed in ascending order.
                else { break; }
            }
            index += change;
        }
        this.set( 'index', Math.min( index,
            ( this.getFromPath( 'content.length' ) || 1 ) - 1
        ));
    }
});

NS.SingleSelectionController = SingleSelectionController;

}( O ) );