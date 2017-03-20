// -------------------------------------------------------------------------- \\
// File: ToManyAttribute.js                                                   \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Record.js, RecordAttribute.js                  \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class, meta } from '../../core/Core.js';  // Also Function#implement
import '../../core/Array.js';  // For Array#erase
import ObservableArray from '../../foundation/ObservableArray.js';

import RecordAttribute from './RecordAttribute.js';
import Record from './Record.js';

var slice = Array.prototype.slice;

// ---

Record.implement({
    /**
        Method: O.Record#notifyRecordArray

        Parameters:
            _       - Unused
            propKey - The propKey that changed on the

        If true, any changes to the record will not be committed to the source.
    */
    notifyRecordArray: function ( _, propKey ) {
        var recordArray = this[ '_' + propKey + 'RecordArray' ];
        var isInCache = propKey in meta( this ).cache;
        // If it's already been updated due to a fetch to the property,
        // the array will be in the cache. Don't waste time calling again.
        if ( recordArray && !isInCache ) {
            recordArray.updateListFromRecord();
        }
    }
});

// ---

var RecordArray = Class({

    Extends: ObservableArray,

    init: function ( record, propKey, value, Type ) {
        this.record = record;
        this.propKey = propKey;
        this.Type = Type;
        this.store = record.get( 'store' );

        this._updatingStore = false;

        RecordArray.parent.init.call( this, value && value.slice() );
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

// ---


var notifyRecordArrayObserver = {
    object: null,
    method: 'notifyRecordArray'
};

var ToManyAttribute = Class({

    Extends: RecordAttribute,

    __setupProperty__: function ( metadata, propKey, object ) {
        ToManyAttribute.parent
            .__setupProperty__.call( this, metadata, propKey, object );
        var observers = metadata.observers;
        var keyObservers = observers[ propKey ];
        if ( !observers.hasOwnProperty( propKey ) ) {
            keyObservers = observers[ propKey ] = keyObservers ?
                keyObservers.slice() : [];
        }
        keyObservers.push( notifyRecordArrayObserver );
    },

    __teardownProperty__: function ( metadata, propKey, object ) {
        ToManyAttribute.parent
            .__teardownProperty__.call( this, metadata, propKey, object );
        var observers = metadata.observers;
        var keyObservers = observers[ propKey ];
        if ( !observers.hasOwnProperty( propKey ) ) {
            keyObservers = observers[ propKey ] = keyObservers.slice();
        }
        keyObservers.erase( notifyRecordArrayObserver );
    },

    Type: Array,
    recordType: null,

    call: function ( record, _, propKey ) {
        var arrayKey = '_' + propKey + 'RecordArray';
        var recordArray = record[ arrayKey ];
        // Race condition: another observer may fetch this before
        // our notifyRecordArray method has been called.
        if ( recordArray ) {
            recordArray.updateListFromRecord();
        } else {
            recordArray = record[ arrayKey ] =
            new RecordArray(
                record,
                propKey,
                ToManyAttribute.parent.call.call(
                    this, record, undefined, propKey ),
                this.recordType
            );
        }
        return recordArray;
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

export default ToManyAttribute;

Record.toMany = function ( mixin ) {
    return new ToManyAttribute( mixin );
};
