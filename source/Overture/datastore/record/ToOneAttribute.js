import { Class } from '../../core/Core.js';

import RecordAttribute from './RecordAttribute.js';
import Record from './Record.js';

const ToOneAttribute = Class({

    Extends: RecordAttribute,

    willSet( propValue, propKey, record ) {
        if ( ToOneAttribute.parent.willSet.call(
                this, propValue, propKey, record ) ) {
            if ( propValue && !propValue.get( 'storeKey' ) ) {
                throw new Error( 'O.ToOneAttribute: ' +
                    'Cannot set connection to record not saved to store.' );
            }
            return true;
        }
        return false;
    },

    call( record, propValue, propKey ) {
        let result = ToOneAttribute.parent.call.call(
            this, record, propValue, propKey );
        if ( result && typeof result === 'string' ) {
            result = record.get( 'store' ).getRecord( this.Type, '#' + result );
        }
        return result || null;
    },
});

export default ToOneAttribute;

Record.toOne = function ( mixin ) {
    return new ToOneAttribute( mixin );
};
