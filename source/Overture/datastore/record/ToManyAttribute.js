// -------------------------------------------------------------------------- \\
// File: ToManyAttribute.js                                                   \\
// Module: DataStore                                                          \\
// Requires: RecordAttribute.js                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var slice = Array.prototype.slice;

var RecordArray = NS.Class({

    Extends: NS.ObservableArray,

    init: function ( record, propKey, value, Type ) {
        this.record = record;
        this.propKey = propKey;
        this.Type = Type;
        this.store = record.get( 'store' );

        this._updatingStore = false;

        RecordArray.parent.init.call( this, value && value.slice() );

        record.addObserverForKey( propKey, this, 'updateListFromRecord' );
    },

    destroy: function () {
        this.get( 'record' ).removeObserverForKey(
            this.get( 'propKey' ), this, 'updateListFromRecord' );
        RecordArray.parent.destroy.call( this );
    },

    toJSON: function () {
        return this._array.slice();
    },

    updateListFromRecord: function () {
        if ( !this._updatingStore ) {
            var record = this.get( 'record' ),
                propKey = this.get( 'propKey' ),
                list = record[ propKey ].getRaw( record, propKey );

            this.set( '[]', list ? list.slice() : [] );
        }
    },

    getObjectAt: function ( index ) {
        var storeKey = RecordArray.parent.getObjectAt.call( this, index );
        return storeKey ?
            this.get( 'store' )
                .getRecord( this.get( 'Type' ), '#' + storeKey ) :
            null;
    },

    setObjectAt: function ( index, value ) {
        this.replaceObjectsAt( index, 1, [ value ] );
        return this;
    },

    replaceObjectsAt: function ( index, numberRemoved, newItems ) {
        newItems = newItems ? slice.call( newItems ) : [];

        var record = this.get( 'record' ),
            propKey = this.get( 'propKey' ),
            Type = this.get( 'Type' ),
            store = this.get( 'store' ),
            oldItems = RecordArray.parent.replaceObjectsAt.call(
                this, index, numberRemoved, newItems.map( function ( record ) {
                    return record.get( 'storeKey' );
                })
            ).map( function ( storeKey ) {
                return store.getRecord( Type, '#' + storeKey );
            });

        this._updatingStore = true;
        record[ propKey ].setRaw( record, propKey, this._array.slice() );
        this._updatingStore = false;

        return oldItems;
    },

    add: function ( record ) {
        var index = this._array.indexOf( record.get( 'storeKey' ) );
        if ( index === -1 ) {
            this.replaceObjectsAt(
                this.get( 'length' ), 0, [ record ] );
        }
        return this;
    },

    remove: function ( record ) {
        var index = this._array.indexOf( record.get( 'storeKey' ) );
        if ( index > -1 ) {
            this.replaceObjectsAt( index, 1 );
        }
        return this;
    }
});

var ToManyAttribute = NS.Class({

    Extends: NS.RecordAttribute,

    Type: Array,
    recordType: null,

    call: function ( record, _, propKey ) {
        var arrayKey = '_' + propKey + 'RecordArray';
        return record[ arrayKey ] || ( record[ arrayKey ] =
            new RecordArray( record, propKey, ToManyAttribute.parent.call.call(
                this, record, undefined, propKey ), this.recordType )
        );
    },

    getRaw: function ( record, propKey ) {
        return ToManyAttribute.parent.call.call(
            this, record, undefined, propKey );
    },

    setRaw: function ( record, propKey, data ) {
        return ToManyAttribute.parent.call.call(
            this, record, data, propKey );
    }
});

NS.ToManyAttribute = ToManyAttribute;

NS.Record.toMany = function ( mixin ) {
    return new ToManyAttribute( mixin );
};

}( O ) );
