// -------------------------------------------------------------------------- \\
// File: Enumerable.js                                                        \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var defaultComparator = function ( a, b ) {
    return a < b ? -1 : a > b ? 1 : 0;
};
var createCallback = function ( callback, bind ) {
    if ( !bind ) {
        return callback;
    }
    return function ( value, index, enumerable ) {
        return callback.call( bind, value, index, enumerable );
    };
};

/**
    Mixin: O.Enumerable

    The Enumerable mixin adds a number of iteration and accessor methods to any
    class with a 'getObjectAt' method that supports numerical values and a 'get'
    method that supports 'length'.

    The native Array type also implements O.Enumerable.
*/
var Enumerable = {

    // :: Accessor methods =====================================================

    /**
        Method: O.Enumerable#first

        Returns:
            {*} The first item in the enumerable.
    */
    first: function () {
        return this.getObjectAt( 0 );
    },

    /**
        Method: O.Enumerable#last

        Returns:
            {*} The last item in the enumerable.
    */
    last: function () {
        return this.getObjectAt( this.get( 'length' ) - 1 );
    },

    /**
        Method: O.Enumerable#indexOf

        Returns the index in the enumerable of the first occurrence of an item.

        Parameters:
            item - {*} The item to search for.
            from - {Number} (optional) The index to start searching from.

        Returns:
            {Number} The (first) index in the array of the item or -1 if not
            found.
    */
    indexOf: function ( item, from ) {
        var l = this.get( 'length' );
        for ( from = ( from < 0 ) ?
                Math.max( 0, l + from ) : ( from || 0 ); from < l; from += 1 ){
            if ( this.getObjectAt( from ) === item ) {
                return from;
            }
        }
        return -1;
    },

    /**
        Method: O.Enumerable#lastIndexOf

        Returns the index in the enumerable of the last occurrence of an item.

        Parameters:
            item - {*} The item to search for.
            from - {Number} (optional) The index to start searching from.

        Returns:
            {Number} The (last) index in the array of the item or -1 if not
            found.
    */
    lastIndexOf: function ( item, from ) {
        var l = this.get( 'length' );
        for ( from = ( from < 0 ) ? ( l + from ) : ( from || l - 1 );
                from >= 0 ; from -= 1 ){
            if ( this.getObjectAt( from ) === item ) {
                return from;
            }
        }
        return -1;
    },

    /**
        Method: Array#binarySearch

        *Presumes the enumerable is sorted.*

        Does a binary search on the array to find the index for the given value,
        or if not in the array, then the index at which it should be inserted to
        maintain the ordering of the array.

        Parameters:
            value      - {*} The value to search for in the array
            comparator - {Function} (optional). A comparator function. If not
                         supplied, the comparison will be made simply by the `<`
                         infix comparator.

        Returns:
            {Number} The index to place the value in the sorted array.
    */
    binarySearch: function ( value, comparator ) {
        var lower = 0,
            upper = this.get( 'length' ),
            middle, candidate;
        if ( !comparator ) { comparator = defaultComparator; }
        while ( lower < upper ) {
            middle = ( lower + upper ) >> 1;
            candidate = this.getObjectAt( middle );
            if ( comparator( candidate, value ) < 0 ) {
                lower = middle + 1;
            } else {
                upper = middle;
            }
        }
        return lower;
    },

    /**
        Method: O.Enumerable#contains

        Tests whether the item is in the enumerable.

        Parameters:
            item - {*} The item to check.

        Returns:
            {Boolean} True if the item is present.
    */
    contains: function ( item ) {
        return this.indexOf( item ) > -1;
    },

    /**
        Method: O.Enumerable#find

        Tests each item in the enumerable with a given function and returns the
        first item for which the function returned a truthy value. The function
        will be supplied with 3 parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to test each value with.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {*} The object found, or null if none found.
    */
    find: function ( fn, bind ) {
        var callback = createCallback( fn, bind );
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            var value = this.getObjectAt( i );
            if ( callback( value, i, this ) ) {
                return value;
            }
        }
        return null;
    },

    // :: Iteration methods ====================================================

    /**
        Method: O.Enumerable#forEach

        Applies the given function to each item in the enumerable. The function
        will be supplied with 3 parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to apply to each value.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {O.Enumerable} Returns self.
    */
    forEach: function ( fn, bind ) {
        var callback = createCallback( fn, bind );
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            callback( this.getObjectAt( i ), i, this );
        }
        return this;
    },

    /**
        Method: O.Enumerable#filter

        Tests each item in the enumerable with a given function and returns an
        array of all items for which the function returned a truthy value. The
        function will be supplied with 3 parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to test each value with.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {Array} The items which were accepted by the function.
    */
    filter: function ( fn, bind ) {
        var callback = createCallback( fn, bind ),
            results = [];
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            var value = this.getObjectAt( i );
            if ( callback( value, i, this ) ) {
                results.push( value );
            }
        }
        return results;
    },

    /**
        Method: O.Enumerable#map

        Applies the given function to each item in the enumerable and returns an
        array of all the results. The function will be supplied with 3
        parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to apply to each value.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {Array} The result of each function call.
    */
    map: function ( fn, bind ) {
        var callback = createCallback( fn, bind ),
            results = [];
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            results[i] = callback( this.getObjectAt( i ), i, this );
        }
        return results;
    },

    /**
        Method: O.Enumerable#reduce

        ECMAScript 5 reduce method.

        Parameters:
            fn      - {Function} The function to apply to the accumulator and
                      each item in the array.
            initial - {*} (optional) The initial value of the accumulator. Taken
                      to be the first value in the array if not supplied.

        Returns:
            {*} The reduced value.
    */
    reduce: function ( fn, initial ) {
        var i = 0,
            l = this.get( 'length' ),
            acc;

        if ( !l && arguments.length === 1 ) {
            throw new TypeError();
        }

        if ( arguments.length >= 2 ) {
            acc = initial;
        } else {
            acc = this.getObjectAt( 0 );
            i = 1;
        }
        for ( ; i < l; i += 1 ) {
            acc = fn( acc, this.getObjectAt( i ), i, this );
        }
        return acc;
    },

    /**
        Method: O.Enumerable#every

        Applies the given function to each item in the enumerable until it finds
        one for which the function returns a falsy value. The function will be
        supplied with 3 parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to apply to test the values with.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {Boolean} Were all items accepted by the function?
    */
    every: function ( fn, bind ) {
        var callback = createCallback( fn, bind );
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            if ( !callback( this.getObjectAt( i ), i, this ) ) {
                return false;
            }
        }
        return true;
    },

    /**
        Method: O.Enumerable#some

        Applies the given function to each item in the enumerable until it finds
        one for which the function returns a truthy value. The function will be
        supplied with 3 parameters when called:

        1. The value.
        2. The index of the value in the enumerable.
        3. The enumerable itself.

        Parameters:
            fn   - {Function} The function to apply to test the values with.
            bind - {Object} (optional) The object to bind the 'this' parameter
                   to on each call of the function.

        Returns:
            {Boolean} Did the function accept at least one item?
    */
    some: function ( fn, bind ) {
        var callback = createCallback( fn, bind );
        for ( var i = 0, l = this.get( 'length' ); i < l; i += 1 ) {
            if ( callback( this.getObjectAt( i ), i, this ) ) {
                return true;
            }
        }
        return false;
    }
};

Array.implement( Enumerable );

NS.Enumerable = Enumerable;

}( this.O ) );
