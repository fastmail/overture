import { Class } from '../core/Core.js';

export default Class({

    init ( comparator ) {
        this.data = [];
        this.length = 0;
        this.comparator = comparator;
    },

    _up ( i ) {
        const data = this.data;
        const comparator = this.comparator;
        let parentNode;

        const node = data[i];
        while ( i ) {
            // Get parent node
            const j = ( i - 1 ) >> 1;
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

    _down ( i ) {
        const data = this.data;
        const length = this.length;
        const comparator = this.comparator;

        const node = data[i];
        while ( true ) {
            let j = ( i << 1 ) + 1;
            const k = j + 1;

            // Does it have children?
            if ( j >= length ) {
                break;
            }
            let childNode = data[j];

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

    push ( node ) {
        if ( node != null ) {
            const length = this.length;
            this.data[ length ] = node;
            this.length = length + 1;
            this._up( length );
        }
        return this;
    },

    pop () {
        const data = this.data;
        let length = this.length;

        if ( !length ) {
            return null;
        }

        const nodeToReturn = data[0];

        length -= 1;
        data[0] = data[ length ];
        data[ length ] = null;
        this.length = length;

        this._down( 0 );

        return nodeToReturn;
    },

    peek () {
        return this.data[0];
    },

    remove ( node ) {
        const data = this.data;
        let length = this.length;
        const i = node == null || !length ?
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
