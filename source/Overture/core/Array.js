// -------------------------------------------------------------------------- \\
// File: Array.js                                                             \\
// Module: Core                                                               \\
// Requires: Core.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

Array.implement({
    /**
        Method: Array#get

        Returns the property of the object with the name given as the only
        parameter.

        Parameters:
            key - {String} The name of the property to return.

        Returns:
            {*} The requested property of this array.
    */
    get: function ( key ) {
        return this[ key ];
    },

    /**
        Method: Array#set

        Sets the value of a given property on the Array.

        Parameters:
            key   - {String} The name of the property to set.
            value - {*} The value to set the property to.

        Returns:
            {Array} Returns self.
    */
    set: function ( key, value ) {
        this[ key ] = value;
        return this;
    },

    /**
        Method: Array#getObjectAt

        Returns the value at a given index in the array.

        Parameters:
            index - {Number} The index of the value to return.

        Returns:
            {*} The value at the given index in this array.
    */
    getObjectAt: function ( index ) {
        return this[ index ];
    },

    /**
        Method: Array#setObjectAt

        Sets the value at a given index in the array.

        Parameters:
            index - {Number} The index at which to set the value.
            value - {*} The value to set at the given index.

        Returns:
            {Array} Returns self.
    */
    setObjectAt: function ( index, value ) {
        this[ index ] = value;
        return this;
    },

    /**
        Method: Array#include

        Adds an item to the end of the array if it is not already present (as
        determined by strict '===' equality).

        Parameters:
            item - {*} The item to add to the array.

        Returns:
            {Array} Returns self.
    */
    include: function ( item ) {
        var i = 0,
            l = this.length;
        while ( i < l && this[i] !== item ) {
            i += 1;
        }
        this[i] = item;
        return this;
    },

    /**
        Method: Array#erase

        Removes all occurrences (as determined by strict '===' equality) of the
        item from the array.

        Parameters:
            item - {*} The item to be removed from the array.

        Returns:
            {Array} Returns self.
    */
    erase: function ( item ) {
        var l = this.length;
        while ( l-- ) {
            if ( this[l] === item ) {
                this.splice( l, 1 );
            }
        }
        return this;
    }
});
