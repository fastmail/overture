// -------------------------------------------------------------------------- \\
// File: ToOneAttribute.js                                                    \\
// Module: DataStore                                                          \\
// Requires: RecordAttribute.js                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var ToOneAttribute = NS.Class({

    Extends: NS.RecordAttribute,

    willCreateInStore: function ( record, propKey, storeKey ) {
        var propValue = record.get( propKey );
        if ( propValue && !propValue.get( 'id' ) ) {
            record.get( 'store' ).attrMapsToStoreKey(
                propValue.get( 'storeKey' ),
                storeKey, this.key || propKey );
        }
    },

    willSet: function ( propValue, propKey, record ) {
        if ( ToOneAttribute.parent.willSet.call(
                this, propValue, propKey, record ) ) {
            var oldPropValue = record.get( propKey ),
                storeKey = record.get( 'storeKey' ),
                store = record.get( 'store' ),
                attrKey = this.key || propKey;
            if ( propValue && !propValue.get( 'storeKey' ) ) {
                throw new Error( 'O.ToOneAttribute: ' +
                    'Cannot set connection to record not saved to store.' );
            }
            if ( storeKey ) {
                if ( oldPropValue && !oldPropValue.get( 'id' ) ) {
                    store.attrNoLongerMapsToStoreKey(
                        oldPropValue.get( 'storeKey' ),
                        storeKey, attrKey );
                }
                if ( propValue && !propValue.get( 'id' ) ) {
                    store.attrMapsToStoreKey(
                        propValue.get( 'storeKey' ),
                        storeKey, attrKey );
                }
            }
            return true;
        }
        return false;
    },

    call: function ( record, propValue, propKey ) {
        var result = ToOneAttribute.parent.call.call(
            this, record, propValue, propKey );
        if ( result && typeof result === 'string' ) {
            result = record.get( 'store' ).getRecord( this.Type, result );
        }
        return result || null;
    }
});

NS.ToOneAttribute = ToOneAttribute;

NS.Record.toOne = function ( mixin ) {
    return new ToOneAttribute( mixin );
};

}( O ) );
