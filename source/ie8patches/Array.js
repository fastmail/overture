// -------------------------------------------------------------------------- \\
// File: Array.js                                                             \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

( function ( undefined ) {

// Note: Does not inclue the `if ( i in this ) {}` check these function should
// have, as IE8 will return false if this[i] is undefined (at least if the array
// was defined with a literal, e.g. `[ undefined, undefined ]`).

var fns = {

    /**
     * @method indexOf
     * @namespace Array
     * @description ECMAScript 5 indexOf method (minus error checking).
     * @param {*} item The item to search for.
     * @param {Number} from (optional) The index to start searching from.
     * @return {Number} Index of item or -1 if not found.
     */
    indexOf: function ( item, from ) {
        var l = this.length;
        for ( var i = ( from < 0 ) ? Math.max( 0, l + from ) : from || 0;
                i < l; i += 1 ) {
            if ( this[i] === item ) {
                return i;
            }
        }
        return -1;
    },

    /**
     * @method lastIndexOf
     * @namespace Array
     * @description ECMAScript 5 lastIndexOf method (minus error checking).
     * @param {*} item The item to search for.
     * @param {Number} from (optional) The index to start searching from.
     * @return {Number} Index of item or -1 if not found.
     */
    lastIndexOf: function ( item, from ) {
        var l = this.length,
            i = Math.min( from < 0 ?
                    Math.max( 0, l + from ) : from || l, l - 1 );
        for ( ; i >= 0; i -= 1 ) {
            if ( this[i] === item ) {
                return i;
            }
        }
        return -1;
    },

    /**
     * @method forEach
     * @namespace Array
     * @description ECMAScript 5 forEach method.
     * @param {Function} fn The function to call on each item in the array.
     * @param {Object} bind The object to bind to the 'this' parameter.
     */
    forEach: function ( fn, bind ) {
        var l = this.length >>> 0;
        if ( typeof fn !== 'function' ) {
            throw new TypeError();
        }
        for ( var i = 0; i < l; i += 1 ) {
            fn.call( bind, this[i], i, this );
        }
    },

    /**
     * @method map
     * @namespace Array
     * @description ECMAScript 5 map method.
     * @param {Function} fn The function to apply to each item in the array.
     * @param {Object} bind The object to bind to the 'this' parameter.
     */
    map: function (fn, bind ){
        var results = [];
        for ( var i = 0, l = this.length; i < l; i += 1 ) {
            results[i] = fn.call( bind, this[i], i, this );
        }
        return results;
    },

    /**
     * @method reduce
     * @namespace Array
     * @description ECMAScript 5 reduce method.
     * @param {Function} fn The function to apply to the accumulator and each
     * item in the array.
     * @param {*} initial (optional) The initial value of the accumulator.
     * Taken to be the first value in the array if not supplied.
     */
    reduce: function ( fn, initial ) {
        var i = 0,
            l = this.length,
            acc;

        if ( !l && arguments.length === 1 ) {
            throw new TypeError();
        }

        if ( arguments.length >= 2 ) {
            acc = initial;
        } else {
            acc = this[0];
            i = 1;
        }
        for ( ; i < l; i += 1 ) {
            acc = fn.call( undefined, acc, this[i], i, this );
        }
        return acc;
    },

    /**
     * @method filter
     * @namespace Array
     * @description ECMAScript 5 filter method.
     * @param {Function} fn The test function to call on each item in the array.
     * @param {Object} bind The object to bind to the 'this' parameter.
     */
    filter: function ( fn, bind ) {
        var results = [];
        for ( var i = 0, l = this.length; i < l; i += 1 ) {
            var value = this[i];
            if ( fn.call( bind, value, i, this ) ) {
                results.push( value );
            }
        }
        return results;
    },

    /**
     * @method some
     * @namespace Array
     * @description ECMAScript 5 some method.
     * @param {Function} fn The test function to call on each item in the array.
     * @param {Object} bind The object to bind to the 'this' parameter.
     */
    some: function ( fn, bind ) {
        for ( var i = 0, l = this.length; i < l; i += 1 ) {
            if ( fn.call( bind, this[i], i, this ) ) {
                return true;
            }
        }
        return false;
    },

    /**
     * @method every
     * @namespace Array
     * @description ECMAScript 5 every method.
     * @param {Function} fn The test function to call on each item in the array.
     * @param {Object} bind The object to bind to the 'this' parameter.
     */
    every: function ( fn, bind ) {
        for ( var i = 0, l = this.length; i < l; i += 1 ) {
            if ( !fn.call( bind, this[i], i, this ) ) {
                return false;
            }
        }
        return true;
    }
};

var proto = Array.prototype;
for ( var key in fns ) {
    if ( !( key in proto ) ) {
        proto[ key ] = fns[ key ];
    }
}

}() );
