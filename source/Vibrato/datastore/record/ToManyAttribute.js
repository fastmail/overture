// -------------------------------------------------------------------------- \\
// File: ToManyAttribute.js                                                   \\
// Module: DataStore                                                          \\
// Requires: RecordAttribute.js                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
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
        if ( this._updatingStore ) { return; }
        var record = this.get( 'record' ),
            propKey = this.get( 'propKey' ),
            list = record[ propKey ].getRaw( record, propKey );

        this.set( '[]', list ? list.slice() : [] );
    },

    getObjectAt: function ( index ) {
        var id = RecordArray.parent.getObjectAt.call( this, index );
        return id ?
            this.get( 'store' ).getRecord( this.get( 'Type' ), id ) : null;
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
            storeKey = record.get( 'storeKey' ),
            oldItems = RecordArray.parent.replaceObjectsAt.call(
                this, index, numberRemoved, newItems.map( function ( record ) {
                    return record.toJSON();
                }) ).map( function ( id ) {
                    return store.getRecord( Type, id );
                });

        this._updatingStore = true;
        this.checkForIds();
        record[ propKey ].setRaw( record, propKey, this._array.slice() );
        this._updatingStore = false;

        if ( storeKey ) {
            oldItems.forEach( function ( foreignRecord ) {
                if ( !foreignRecord.get( 'id' ) ) {
                    store.attrNoLongerMapsToStoreKey(
                        foreignRecord.get( 'storeKey' ), storeKey, propKey );
                }
            });
            newItems.forEach( function ( foreignRecord ) {
                if ( !foreignRecord.get( 'id' ) ) {
                    store.attrMapsToStoreKey(
                        foreignRecord.get( 'storeKey' ), storeKey, propKey );
                }
            });
        }

        return oldItems;
    },

    add: function ( record ) {
        var index = this._array.indexOf( record.toJSON() );
        if ( index === -1 ) {
            this.replaceObjectsAt(
                this.get( 'length' ), 0, [ record ] );
        }
        return this;
    },

    remove: function ( record ) {
        var index = this._array.indexOf( record.toJSON() );
        if ( index > -1 ) {
            this.replaceObjectsAt( index, 1 );
        }
        return this;
    },

    willCreateInStore: function ( record, propKey, storeKey ) {
        var array = this._array,
            l = array.length,
            store = this.get( 'store' ),
            id;

        while ( l-- ) {
            id = array[l];
            if ( id.charAt( 0 ) === '#' ) {
                store.attrMapsToStoreKey( id.slice( 1 ), storeKey, propKey );
            }
        }
    },

    checkForIds: function () {
        var array = this._array,
            l = array.length,
            id, record;

        while ( l-- ) {
            id = array[l];
            if ( id.charAt( 0 ) === '#' ) {
                record = this.getObjectAt( l );
                id = record.get( 'id' );
                if ( id ) {
                    array[l] = id;
                }
            }
        }
    }
});

var ToManyAttribute = NS.Class({

    Extends: NS.RecordAttribute,

    Type: Array,
    recordType: null,

    willCreateInStore: function ( record, propKey, storeKey ) {
        var recordArray = record[ '_' + propKey + 'RecordArray' ];
        if ( recordArray ) {
            recordArray.willCreateInStore( record, propKey, storeKey );
        }
    },

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

}( this.O ) );
