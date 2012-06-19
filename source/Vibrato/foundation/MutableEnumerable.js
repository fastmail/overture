// -------------------------------------------------------------------------- \\
// File: MutableEnumerable.js                                                 \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var slice = Array.prototype.slice;

/**
    Mixin: O.MutableEnumerable
    
    The MutableEnumerable mixin adds a number of mutation methods to any class
    with a 'replaceObjectsAt' method and a 'get' method that supports 'length'.
    The API mirrors that of the native Array type.
*/
NS.MutableEnumerable = {

    // :: Mutation methods =====================================================

    /**
        Method: O.MutableEnumerable#push
    
        ECMAScript Array#push.
    
        Parameters:
            var_args - {...*} The items to add to the end of the array.
    
        Returns:
            {Number} The new length of the array.
    */
    push: function () {
        var newItems = slice.call( arguments );
        this.replaceObjectsAt( this.get( 'length' ), 0, newItems );
        return this.get( 'length' );
    },

    /**
        Method: O.MutableEnumerable#pop
    
        ECMAScript Array#pop.
    
        Returns:
            {*} The removed last value from the array.
    */
    pop: function () {
        var length = this.get( 'length' );
        return length === 0 ?
            undefined : this.replaceObjectsAt( length - 1, 1 )[0];
    },

    /**
        Method: O.MutableEnumerable#unshift
    
        ECMAScript Array#unshift.
    
        Parameters:
            var_args - {...*} The items to add to the beginning of the array.
    
        Returns:
            {Number} The new length of the array.
    */
    unshift: function () {
        var newItems = slice.call( arguments );
        this.replaceObjectsAt( 0, 0, newItems );
        return this.get( 'length' );
    },

    /**
        Method: O.MutableEnumerable#shift
    
        ECMAScript Array#shift.
    
        Returns:
            {*} The removed first value from the array.
    */
    shift: function () {
        return this.get( 'length' ) === 0 ?
            undefined : this.replaceObjectsAt( 0, 1 )[0];
    },

    /**
        Method: O.MutableEnumerable#splice
    
        ECMAScript Array#splice.
    
        Parameters:
            index         - {Number} The index to start removing/inserting items
                            at.
            numberRemoved - {Number} The number of items to remove.
            var_args      - {...*} The items to insert starting from position
                            index.
    
        Returns:
            {Array} The items removed from the array.
    */
    splice: function ( index, numberRemoved ) {
        var newItems = slice.call( arguments, 2 );
        return this.replaceObjectsAt( index, numberRemoved, newItems );
    }
};

}( this.O ) );