import { RecordAttribute } from './attr';

class ToOneAttribute extends RecordAttribute {
    willSet ( propValue, propKey, record ) {
        if ( super.willSet( propValue, propKey, record ) ) {
            if ( record.get( 'storeKey' ) &&
                    propValue && !propValue.get( 'storeKey' ) ) {
                throw new Error( 'O.ToOneAttribute: ' +
                    'Cannot set connection to record not saved to store.' );
            }
            return true;
        }
        return false;
    }

    call ( record, propValue, propKey ) {
        let result = super.call( record, propValue, propKey );
        if ( result && typeof result === 'string' ) {
            result = record.get( 'store' ).getRecordFromStoreKey( result );
        }
        return result || null;
    }
}

// Referenced record may be garbage collected independently of this record,
// so always ask store for the value.
ToOneAttribute.prototype.isVolatile = true;

const toOne = function ( mixin ) {
    return new ToOneAttribute( mixin );
};

export default toOne;
export { toOne, ToOneAttribute };
