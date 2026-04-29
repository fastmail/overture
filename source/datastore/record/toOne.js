import { RecordAttribute } from './attr.js';

class ToOneAttribute extends RecordAttribute {
    willSet(propValue, propKey, record) {
        if (super.willSet(propValue, propKey, record)) {
            if (
                record.get('storeKey') &&
                propValue &&
                !propValue.get('storeKey')
            ) {
                throw new Error(
                    'O.ToOneAttribute: ' +
                        'Cannot set connection to record not saved to store.',
                );
            }
            return true;
        }
        return false;
    }

    call(record, propValue, propKey) {
        let result = super.call(record, propValue, propKey);
        // The raw value in data is the foreign storeKey (numeric); resolve
        // it to a Record. After a setter call result is already a Record.
        if (result && typeof result === 'number') {
            result = record.get('store').getRecordFromStoreKey(result);
        }
        return result || null;
    }
}

// Referenced record may be garbage collected independently of this record,
// so always ask store for the value.
ToOneAttribute.prototype.isVolatile = true;

const toOne = function (mixin) {
    return new ToOneAttribute(mixin);
};

export { toOne, ToOneAttribute };
