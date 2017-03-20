// -------------------------------------------------------------------------- \\
// File: Heap.js                                                              \\
// Module: Foundation                                                         \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';

export default Class({

    init: function ( comparator ) {
        this.data = [];
        this.length = 0;
        this.comparator = comparator;
    },

    _up: function ( i ) {
        var data = this.data,
            comparator = this.comparator,
            j, node, parentNode;

        node = data[i];
        while ( i ) {
            // Get parent node
            j = ( i - 1 ) >> 1;
            parentNode = data[j];
            // If node is bigger than or equal to parent, we're done
            if ( comparator( node, parentNode ) >= 0 ) {
                break;
            }
            // Otherwise swap and continue up tree
            data[j] = node;
            data[i] = parentNode;
            i = j;
        }
        return i;
    },

    _down: function ( i ) {
        var data = this.data,
            length = this.length,
            comparator = this.comparator,
            node, j, k, childNode;

        node = data[i];
        while ( true ) {
            j = ( i << 1 ) + 1;
            k = j + 1;

            // Does it have children?
            if ( j >= length ) {
                break;
            }
            childNode = data[j];

            // Get the smaller child
            if ( k < length && comparator( childNode, data[k] ) > 0 ) {
                childNode = data[k];
                j = k;
            }

            // If node is smaller than or equal to child, we're done
            if ( comparator( node, childNode ) <= 0 ) {
                break;
            }
            // Otherwise, swap and continue down tree
            data[j] = node;
            data[i] = childNode;
            i = j;
        }

        return i;
    },

    push: function ( node ) {
        if ( node != null ) {
            var length = this.length;
            this.data[ length ] = node;
            this.length = length + 1;
            this._up( length );
        }
        return this;
    },

    pop: function () {
        var data = this.data,
            length = this.length,
            nodeToReturn;

        if ( !length ) {
            return null;
        }

        nodeToReturn = data[0];

        length -= 1;
        data[0] = data[ length ];
        data[ length ] = null;
        this.length = length;

        this._down( 0 );

        return nodeToReturn;
    },

    peek: function () {
        return this.data[0];
    },

    remove: function ( node ) {
        var data = this.data,
            length = this.length,
            i = node == null || !length ?
                -1 : data.lastIndexOf( node, length - 1 );

        // Not found
        if ( i < 0 ) {
            return this;
        }

        // Move last node to fill gap
        length -= 1;
        data[i] = data[ length ];
        data[ length ] = null;
        this.length = length;

        // Fast path: removing last-place item. Tree is already correct
        // Otherwise, we have to rebalance. Sift up, then sift down.
        if ( i !== length ) {
            this._down( this._up( i ) );
        }

        return this;
    },
});
