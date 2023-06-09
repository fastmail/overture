/**
    Class: Heap

    Represents a binary heap data structure. Uses the Heap#comparator function
    to maintain Heap order.
*/
class Heap {
    constructor(comparator) {
        this.data = [];
        this.length = 0;
        this.comparator = comparator;
    }

    /**
     Method (private): Heap#_up

        Moves an element up the heap until the heap's comparator is satisfied. It
        starts with the element at the provided index and uses the comparator
        function to compare it to its parent node, swapping positions as
        necessary.

        Parameters:
            i - {Number} The index of the element to be moved up.

        Returns:
            {Number} The index of the element after moving it up.
     */
    _up(i) {
        const data = this.data;
        const comparator = this.comparator;
        let parentNode;

        const node = data[i];
        while (i) {
            // Get parent node
            const j = (i - 1) >> 1;
            parentNode = data[j];
            // If node is bigger than or equal to parent, we're done
            if (comparator(node, parentNode) >= 0) {
                break;
            }
            // Otherwise swap and continue up tree
            data[j] = node;
            data[i] = parentNode;
            i = j;
        }
        return i;
    }

    /**
     Method (private): Heap#_down

        Moves an element down the heap until the heap's comparator is satisfied. It
        starts with the element at the provided index and uses the comparator
        function to compare it to its children nodes, swapping positions as
        necessary.

        Parameters:
            i - {Number} The index of the element to be moved down.

        Returns:
            {Number} The index of the element after moving it down.
     */
    _down(i) {
        const data = this.data;
        const length = this.length;
        const comparator = this.comparator;

        const node = data[i];
        while (true) {
            let j = (i << 1) + 1;
            const k = j + 1;

            // Does it have children?
            if (j >= length) {
                break;
            }
            let childNode = data[j];

            // Get the smaller child
            if (k < length && comparator(childNode, data[k]) > 0) {
                childNode = data[k];
                j = k;
            }

            // If node is smaller than or equal to child, we're done
            if (comparator(node, childNode) <= 0) {
                break;
            }
            // Otherwise, swap and continue down tree
            data[j] = node;
            data[i] = childNode;
            i = j;
        }

        return i;
    }

    /**
     Method: Heap#push

        Adds an element to the heap. It initially adds the provided element to
        the bottom of the Heap instance. It maintains the heap's comparator by
        incrementing the length and calling Heap#_up using the incremented
        length as the provided index.

        Parameters:
            node - {*} The element to be added to the heap.

        Returns:
            {Object} The Heap instance.
     */
    push(node) {
        if (node != null) {
            const length = this.length;
            this.data[length] = node;
            this.length = length + 1;
            this._up(length);
        }
        return this;
    }

    /**
     Method: Heap#pop

        Removes and returns the top element from the Heap instance. It then
        decrements the length and calls Heap#_down from index 0 to maintain
        the heap's comparator.

        Returns:
            {*} The element that was removed from the heap.
    */
    pop() {
        const data = this.data;
        let length = this.length;

        if (!length) {
            return null;
        }

        const nodeToReturn = data[0];

        length -= 1;
        data[0] = data[length];
        data[length] = null;
        this.length = length;

        this._down(0);

        return nodeToReturn;
    }

    /**
     Method: Heap#peek

        Returns the top element of the Heap instance without removing it.

        Returns:
            {*} The top element of the Heap.
     */
    peek() {
        return this.data[0];
    }

    /**
     Method: Heap#remove

        Removes the provided element from the heap. If the element is found, it
        decrements the length and, if necessary, calls Heap#_up followed by
        Heap#_down to maintain the heap's comparator.

        Parameters:
            node - {*} The element to be removed from the heap.

        Returns:
            {Object} The Heap instance.
     */
    remove(node) {
        const data = this.data;
        let length = this.length;
        const i =
            node == null || !length ? -1 : data.lastIndexOf(node, length - 1);

        // Not found
        if (i < 0) {
            return this;
        }

        // Move last node to fill gap
        length -= 1;
        data[i] = data[length];
        data[length] = null;
        this.length = length;

        // Fast path: removing last-place item. Tree is already correct
        // Otherwise, we have to rebalance. Sift up, then sift down.
        if (i !== length) {
            this._down(this._up(i));
        }

        return this;
    }

    /**
     Method: Heap#forEach

        Iterates over each element in the Heap instance and applies the provided
        function to it.

        Parameters:
            fn - {Function} The function to call with each element in the Heap
                  instance.
     */
    forEach(fn) {
        const data = this.data;
        for (let i = 0, l = this.length; i < l; i += 1) {
            fn(data[i]);
        }
    }
}

export { Heap };
