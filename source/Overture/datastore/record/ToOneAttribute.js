// -------------------------------------------------------------------------- \\
// File: ToOneAttribute.js                                                    \\
// Module: DataStore                                                          \\
// Requires: RecordAttribute.js                                               \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var ToOneAttribute = NS.Class({

    Extends: NS.RecordAttribute,

    willSet: function ( propValue, propKey, record ) {
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

    call: function ( record, propValue, propKey ) {
        var result = ToOneAttribute.parent.call.call(
            this, record, propValue, propKey );
        if ( result && typeof result === 'string' ) {
            result = record.get( 'store' ).getRecord( this.Type, '#' + result );
        }
        return result || null;
    }
});

NS.ToOneAttribute = ToOneAttribute;

NS.Record.toOne = function ( mixin ) {
    return new ToOneAttribute( mixin );
};

}( O ) );
