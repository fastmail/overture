import { Class } from '../../core/Core';

import RecordAttribute from './RecordAttribute';
import Record from './Record';

const ToOneAttribute = Class({

    Extends: RecordAttribute,

    // Referenced record may be garbage collected independently of this record,
    // so always ask store for the value.
    isVolatile: true,

    willSet ( propValue, propKey, record ) {
        if ( ToOneAttribute.parent.willSet.call(
                this, propValue, propKey, record ) ) {
            if ( record.get( 'storeKey' ) &&
                    propValue && !propValue.get( 'storeKey' ) ) {
                throw new Error( 'O.ToOneAttribute: ' +
                    'Cannot set connection to record not saved to store.' );
            }
            return true;
        }
        return false;
    },

    call ( record, propValue, propKey ) {
        let result = ToOneAttribute.parent.call.call(
            this, record, propValue, propKey );
        if ( result && typeof result === 'string' ) {
            result = record.get( 'store' ).getRecordFromStoreKey( result );
        }
        return result || null;
    },
});

export default ToOneAttribute;
