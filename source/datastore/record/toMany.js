import { Class, meta } from '../../core/Core';
import '../../core/Array';  // For Array#erase
import ObservableArray from '../../foundation/ObservableArray';

import { RecordAttribute } from './attr';
import Record from './Record';

const slice = Array.prototype.slice;

// ---

/**
    Method: O.Record#notifyRecordArray

    Parameters:
        _       - Unused
        propKey - The propKey that changed on the

    If true, any changes to the record will not be committed to the source.
*/
Record.prototype.notifyRecordArray = function ( _, propKey ) {
    const recordArray = this[ '_' + propKey + 'RecordArray' ];
    const isInCache = propKey in meta( this ).cache;
    // If it's already been updated due to a fetch to the property,
    // the array will be in the cache. Don't waste time calling again.
    if ( recordArray && !isInCache ) {
        recordArray.updateFromRecord();
    }
};

const mapToTrue = function ( result, key ) {
    result[ key ] = true;
    return result;
};

// ---

const RecordArray = Class({

    Extends: ObservableArray,

    init: function ( record, propKey, Type ) {
        this.record = record;
        this.propKey = propKey;
        this.Type = Type;
        this.store = record.get( 'store' );

        this._updatingStore = false;

        RecordArray.parent.constructor.call( this );
    },

    toJSON () {
        return this._array.slice();
    },

    updateFromRecord () {
        if ( !this._updatingStore ) {
            const record = this.get( 'record' );
            const propKey = this.get( 'propKey' );
            let list = record[ propKey ].getRaw( record, propKey );
            if ( !list ) {
                list = [];
            } else if ( record[ propKey ].Type === Object ) {
                list = Object.keys( list );
                list.sort();
            } else {
                list = list.slice();
            }

            this.set( '[]', list );
        }
    },

    getObjectAt ( index ) {
        const storeKey = RecordArray.parent.getObjectAt.call( this, index );
        return storeKey ?
            this.get( 'store' ).getRecordFromStoreKey( storeKey ) :
            null;
    },

    setObjectAt ( index, value ) {
        this.replaceObjectsAt( index, 1, [ value ] );
        return this;
    },

    replaceObjectsAt ( index, numberRemoved, newItems ) {
        newItems = newItems ? slice.call( newItems ) : [];

        const record = this.get( 'record' );
        const propKey = this.get( 'propKey' );
        const store = this.get( 'store' );
        const oldItems = RecordArray.parent.replaceObjectsAt.call(
                this, index, numberRemoved, newItems.map( function ( record ) {
                    return record.get( 'storeKey' );
                })
            ).map( function ( storeKey ) {
                return store.getRecordFromStoreKey( storeKey );
            });
        let value = this._array;

        this._updatingStore = true;
        if ( record[ propKey ].Type === Object ) {
            value = value.reduce( mapToTrue, {} );
        } else {
            value = value.slice();
        }
        record[ propKey ].setRaw( record, propKey, value );
        this._updatingStore = false;

        return oldItems;
    },

    add ( record ) {
        const index = this._array.indexOf( record.get( 'storeKey' ) );
        if ( index === -1 ) {
            this.replaceObjectsAt(
                this.get( 'length' ), 0, [ record ] );
        }
        return this;
    },

    remove ( record ) {
        const index = this._array.indexOf( record.get( 'storeKey' ) );
        if ( index > -1 ) {
            this.replaceObjectsAt( index, 1 );
        }
        return this;
    },
});

// ---


const notifyRecordArrayObserver = {
    object: null,
    method: 'notifyRecordArray',
};

const ToManyAttribute = Class({

    Extends: RecordAttribute,

    __setupProperty__ ( metadata, propKey, object ) {
        ToManyAttribute.parent
            .__setupProperty__.call( this, metadata, propKey, object );
        metadata.addObserver( propKey, notifyRecordArrayObserver );
    },

    __teardownProperty__ ( metadata, propKey, object ) {
        ToManyAttribute.parent
            .__teardownProperty__.call( this, metadata, propKey, object );
        metadata.removeObserver( propKey, notifyRecordArrayObserver );
    },

    Type: Array,
    recordType: null,

    call ( record, propValue, propKey ) {
        const arrayKey = '_' + propKey + 'RecordArray';
        let recordArray = record[ arrayKey ];
        if ( !recordArray ) {
            recordArray = record[ arrayKey ] =
                new RecordArray( record, propKey, this.recordType );
        }
        // Race condition: another observer may fetch this before
        // our notifyRecordArray method has been called.
        recordArray.updateFromRecord();
        if ( propValue !== undefined ) {
            recordArray
                .replaceObjectsAt( 0,
                    recordArray.get( 'length' ),
                    propValue.map( x => x )
                );
        }
        return recordArray;
    },

    getRaw ( record, propKey ) {
        return ToManyAttribute.parent.call.call(
            this, record, undefined, propKey );
    },

    setRaw ( record, propKey, data ) {
        return ToManyAttribute.parent.call.call(
            this, record, data, propKey );
    },
});

const toMany = function ( mixin ) {
    return new ToManyAttribute( mixin );
};

export default toMany;
export { toMany, ToManyAttribute };
