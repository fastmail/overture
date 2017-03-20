// -------------------------------------------------------------------------- \\
// File: ObservableArray.js                                                   \\
// Module: Foundation                                                         \\
// Requires: Object.js,ObservableRange.js,Enumerable.js,MutableEnumerable.js  \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';
import Object from './Object.js';
import ObservableRange from './ObservableRange.js';
import Enumerable from './Enumerable.js';
import MutableEnumerable from './MutableEnumerable.js';
import './ComputedProps.js';  // For Function#property

var splice = Array.prototype.splice;
var slice = Array.prototype.slice;

/**
    Class: O.ObservableArray

    Extends: O.Object

    Includes: O.ObservableRange, O.Enumerable, O.MutableEnumerable

    The ObservableArray class provides an object with the same interface as the
    standard array but with the difference that properties or even ranges can be
    observed. Note, all access must be via getObjectAt/setObjectAt, not direct
    array[i].
*/
var ObservableArray = Class({

    Extends: Object,

    Mixin: [ ObservableRange, Enumerable, MutableEnumerable ],

    /**
        Constructor: O.ObservableArray

        Parameters:
            array   - {Array} (optional) The initial contents of the array.
            mixin - {Object} (optional)
    */
    init: function ( array, mixin ) {
        this._array = array || [];
        this._length = this._array.length;

        ObservableArray.parent.init.call( this, mixin );
    },

    /**
        Property: O.ObservableArray#[]
        Type: Array

        The standard array underlying the object. Observers of this property
        will be notified any time any content changes in the array. Setting this
        property changes the entire contents of the array at once. The contents
        of the new array is checked for equality with that of the old array to
        ensure accurate notification of the changed range.
    */
    '[]': function ( array ) {
        if ( array ) {
            var oldArray = this._array,
                oldLength = this._length,
                newLength = array.length,
                start = 0,
                end = newLength;

            this._array = array;
            this._length = newLength;

            while ( ( start < newLength ) &&
                    ( array[ start ] === oldArray[ start ] ) ) {
                start += 1;
            }
            if ( newLength === oldLength ) {
                var last = end - 1;
                while ( ( end > start ) &&
                        ( array[ last ] === oldArray[ last ] ) ) {
                    end = last;
                    last -= 1;
                }
            } else {
                end = Math.max( oldLength, newLength );
                this.propertyDidChange( 'length', oldLength, newLength );
            }

            if ( start !== end ) {
                this.rangeDidChange( start, end );
            }
        }
        return this._array.slice();
    }.property(),

    /**
        Method: O.ObservableArray#getObjectAt

        Returns the value at the index given in the array.

        Parameters:
            index - {Number} The index of the value to return.

        Returns:
            {*} The value at index i in this array.
    */
    getObjectAt: function ( index ) {
        return this._array[ index ];
    },

    /**
        Property: O.ObservableArray#length
        Type: Number

        The length of the array.
    */
    length: function ( value ) {
        var length = this._length;
        if ( typeof value === 'number' && value !== length ) {
            this._array.length = value;
            this._length = value;
            if ( value < length ) {
                this.rangeDidChange( value, length );
            }
            length = value;
        }
        return length;
    }.property().nocache(),

    /**
        Method: O.ObservableArray#setObjectAt

        Sets the value at a given index in the array.

        Parameters:
            index - {Number} The index at which to set the value.
            value - {*} The value to set it to.

        Returns:
            {O.ObservableArray} Returns self.
    */
    setObjectAt: function ( index, value ) {
        this._array[ index ] = value;
        var length = this._length;
        if ( length <= index ) {
            this._length = index + 1;
            this.propertyDidChange( 'length', length, index + 1 );
        }
        this.rangeDidChange( index );
        return this;
    },

    /**
        Method: O.ObservableArray#replaceObjectsAt

        Removes a given number of objects from the array, starting at the index
        given, and inserts a number of objects in their place.

        Parameters:
            index         - {Number} The index at which to remove/add objects.
            numberRemoved - {Number} The number of objects to remove.
            newItems      - {Array} (optional) The objects to insert.

        Returns:
            {Array} Returns an array of the removed objects.
    */
    replaceObjectsAt: function ( index, numberRemoved, newItems ) {
        var oldLength = this._length,
            array = this._array,
            removed, newLength, i, l;

        newItems = newItems ? slice.call( newItems ) : [];

        if ( oldLength <= index ) {
            for ( i = 0, l = newItems.length; i < l; i += 1 ) {
                array[ index + i ] = newItems[i];
            }
        } else {
            newItems.unshift( index, numberRemoved );
            removed = splice.apply( array, newItems );
        }
        newLength = array.length;
        if ( oldLength !== newLength ) {
            this._length = newLength;
            this.propertyDidChange( 'length', oldLength, newLength );
            this.rangeDidChange( index, Math.max( oldLength, newLength ) );
        } else {
            this.rangeDidChange( index, index + numberRemoved );
        }
        return removed || [];
    },

    // :: Mutation methods =====================================================

    /**
        Method: O.ObservableArray#sort

        ECMAScript Array#sort.

        Parameters:
            comparefn - {Function} (optional) The function to use to compare two
                        items in the array.

        Returns:
            {O.ObservableArray} Returns self.
    */
    sort: function ( comparefn ) {
        this._array.sort( comparefn );
        this.rangeDidChange( 0, this._length );
        return this;
    },

    /**
        Method: O.ObservableArray#reverse

        ECMAScript Array#reverse.

        Returns:
            {O.ObservableArray} Returns self.
    */
    reverse: function () {
        this._array.reverse();
        this.rangeDidChange( 0, this._length );
        return this;
    },

    // :: Accessor methods =====================================================

    /**
        Method: O.ObservableArray#concat

        ECMAScript Array#concat.

        Parameters:
            var_args - {...Array} The arrays to concatenate with this array.

        Returns:
            {Array} Returns new concatenated array.
    */
    concat: function () {
        var args = [],
            i, l, item;
        for ( i = 0, l = arguments.length; i < l; i += 1 ) {
            item = arguments[i];
            args[i] = item instanceof ObservableArray ? item._array : item;
        }
        return Array.prototype.concat.apply( this._array, args );
    },

    /**
        Method: O.ObservableArray#join

        ECMAScript Array#join.

        Parameters:
            separator - {String} (optional) The string to insert between each
                        item (defaults to ',').

        Returns:
            {String} Concatenated string of all items joined by separator
            string.
    */
    join: function ( separator ) {
        return this._array.join( separator );
    },

    /**
        Method: O.ObservableArray#slice

        ECMAScript Array#slice.

        Parameters:
            start - {Number} (optional) The index of the first item to include.
            end   - {Number} (optional) One past the index of the last item to
                    include.

        Returns:
            {Array} Shallow copy of the underlying array between the given
            indexes.
    */
    slice: function ( start, end ) {
        return this._array.slice( start, end );
    },
});

export default ObservableArray;
