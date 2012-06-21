// -------------------------------------------------------------------------- \\
// File: RecordArray.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.RecordArray

    Extends: O.Object

    Includes: O.Enumerable

    An immutable enumerable object representing a list of records.
 */
var RecordArray = NS.Class({

  Extends: NS.Object,

  Mixin: NS.Enumerable,

  init: function ( store, Type, storeKeys ) {
      this.store = store;
      this.type = Type;
      this.storeKeys = storeKeys;
      RecordArray.parent.init.call( this );
  },

  /**
      Property: O.RecordArray#length
      Type: Number

      The number of records in the array.
  */
  length: function () {
      return this.get( 'storeKeys' ).length;
  }.property( 'storeKeys' ),

  /**
      Method: O.RecordArray#getObjectAt

      Returns the record at the index given in the array.

      Parameters:
          index - {Number} The index of the record to return.

      Returns:
          {O.Record} The record at index i in this array.
  */
  getObjectAt: function ( index ) {
      var storeKey = this.get( 'storeKeys' )[ index ];
      return this.get( 'store' )
                 .materialiseRecord( storeKey, this.get( 'type' ) );
  }
});

NS.RecordArray = RecordArray;

}( this.O ) );
