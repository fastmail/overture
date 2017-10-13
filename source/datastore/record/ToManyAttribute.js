import { Class, meta } from '../../core/Core';
import '../../core/Array';  // For Array#erase
import ObservableArray from '../../foundation/ObservableArray';

import RecordAttribute from './RecordAttribute';
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

// ---

const RecordArray = Class({

    Extends: ObservableArray,

    init ( record, propKey, value, Type ) {
        this.record = record;
        this.propKey = propKey;
        this.Type = Type;
        this.store = record.get( 'store' );

        this._updatingStore = false;

        RecordArray.parent.constructor.call( this, value && value.slice() );
    },

    toJSON () {
        return this._array.slice();
    },

    updateFromRecord () {
        if ( !this._updatingStore ) {
            const record = this.get( 'record' );
            const propKey = this.get( 'propKey' );
            const list = record[ propKey ].getRaw( record, propKey );

            this.set( '[]', list ? list.slice() : [] );
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
        const Type = this.get( 'Type' );
        const store = this.get( 'store' );
        const oldItems = RecordArray.parent.replaceObjectsAt.call(
                this, index, numberRemoved, newItems.map( function ( record ) {
                    return record.get( 'storeKey' );
                })
            ).map( function ( storeKey ) {
                return store.getRecordFromStoreKey( storeKey );
            });

        this._updatingStore = true;
        record[ propKey ].setRaw( record, propKey, this._array.slice() );
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
        const observers = metadata.observers;
        let keyObservers = observers[ propKey ];
        if ( !observers.hasOwnProperty( propKey ) ) {
            keyObservers = observers[ propKey ] = keyObservers ?
                keyObservers.slice() : [];
        }
        keyObservers.push( notifyRecordArrayObserver );
    },

    __teardownProperty__ ( metadata, propKey, object ) {
        ToManyAttribute.parent
            .__teardownProperty__.call( this, metadata, propKey, object );
        const observers = metadata.observers;
        let keyObservers = observers[ propKey ];
        if ( !observers.hasOwnProperty( propKey ) ) {
            keyObservers = observers[ propKey ] = keyObservers.slice();
        }
        keyObservers.erase( notifyRecordArrayObserver );
    },

    Type: Array,
    recordType: null,

    call ( record, propValue, propKey ) {
        const arrayKey = '_' + propKey + 'RecordArray';
        let recordArray = record[ arrayKey ];
        // Race condition: another observer may fetch this before
        // our notifyRecordArray method has been called.
        if ( recordArray ) {
            recordArray.updateFromRecord();
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
        if ( propValue !== undefined ) {
            recordArray
                .replaceObjectsAt( 0,
                    recordArray.get( 'length' ),
                    propValue.map( function ( x ) { return x; } )
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

export default ToManyAttribute;

Record.toMany = function ( mixin ) {
    return new ToManyAttribute( mixin );
};
