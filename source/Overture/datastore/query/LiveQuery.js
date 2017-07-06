import { Class, guid } from '../../core/Core.js';
import sortByProperties from '../../core/sortByProperties.js';
import Obj from '../../foundation/Object.js';
import ObservableRange from '../../foundation/ObservableRange.js';
import Enumerable from '../../foundation/Enumerable.js';
import '../../foundation/ComputedProps.js';  // For Function#property, #nocache

import { READY, DESTROYED } from '../record/Status.js';

const numerically = function ( a, b ) {
    return a - b;
};

/**
    Class: O.LiveQuery

    Extends: O.Object

    Includes: O.ObserverableRange, O.Enumerable

    A LiveQuery instance can be treated as an observable array which
    automatically updates its contents to reflect a certain query on the store.
    A query consists of a particular type, a filter function and a sort order.
    Normally you will not create a LiveQuery instance yourself but get it by
    retrieving the query from the store.
 */
const LiveQuery = Class({

    Extends: Obj,

    Mixin: [ ObservableRange, Enumerable ],

    /**
        Property: O.LiveQuery#id
        Type: String

        A unique identifier for this query.
    */
    id: function () {
        return guid( this );
    }.property().nocache(),

    /**
        Property (private): O.LiveQuery#_filter
        Type: (Function|null)

        The function to filter data objects with.
    */

    /**
        Property (private): O.LiveQuery#_sort
        Type: (Function|null)

        The function to sort the data objects with.
    */

    /**
        Property: O.LiveQuery#store
        Type: O.Store

        The store to query for records.
    */

    /**
        Property: O.LiveQuery#Type
        Type: O.Class

        The Record class constructor function for the type of the instances to
        include in this query.
    */

    /**
        Property: O.LiveQuery#status
        Type: O.Status

        Status of the query: READY|DESTROYED
    */

    /**
        Constructor: O.LiveQuery

        The following properties should be configured:

        store  - {O.Store} The store to query for records.
        Type   - {O.Class} The constructor for the record type this query is a
                 collection of.
        filter - {Function} (optional) If supplied, only records which this
                 function returns a truthy value for are included in the
                 results.
        sort   - {(String|String[]|Function)} (optional) The records in
                 the local query are sorted according to this named property. If
                 an array is supplied, in the case of a tie the next property in
                 the array will be consulted. If a function is supplied, this is
                 used as the sort function directly on the records. If nothing
                 is supplied, the results are not guaranteed to be in any
                 particular order.

        Parameters:
            mixin - {Object} The properties for the query.
    */
    init ( mixin ) {
        const Type = mixin.Type;
        let sort = mixin.sort;
        const store = mixin.store || this.store;

        if ( sort && !( sort instanceof Function ) ) {
            sort = mixin.sort = sortByProperties( sort );
        }
        const results = store.findAll( Type, mixin.filter, sort );

        this._storeKeys = results;
        this._sort = results.sortFn;
        this._filter = results.filterFn;

        this.status = READY;

        this.length = results.length;

        LiveQuery.parent.init.call( this, mixin );

        store.addQuery( this );
    },

    /**
        Method: O.LiveQuery#destroy

        Call this method when you have finished with a local query to ensure it
        does not continue monitoring the store for changes and can be garbage
        collected.
    */
    destroy () {
        this.set( 'status', DESTROYED );
        this.get( 'store' ).removeQuery( this );
        LiveQuery.parent.destroy.call( this );
    },

    /**
        Method: O.LiveQuery#is

        Checks whether the query has a particular status.

        Parameters:
            status - {O.Status} The status to check.

        Returns:
            {Boolean} True if the record has the queried status.
    */
    is ( status ) {
        return !!( this.get( 'status' ) & status );
    },

    /**
        Property: O.LiveQuery#[]
        Type: Array

        A standard array of record objects for the records in this query.
    */
    '[]': function () {
        const store = this.get( 'store' );
        const Type = this.get( 'Type' );
        return this._storeKeys.map( function ( storeKey ) {
            return store.materialiseRecord( storeKey, Type );
        });
    }.property().nocache(),

    /**
        Property: O.LiveQuery#length
        Type: Number

        The number of records in the query.
    */

    /**
        Method: O.LiveQuery#indexOfStoreKey

        Finds the index of an id in the query. If the id is not found, the index
        returned will be -1.

        Parameters:
            storeKey - {String} The record store key to find.
            from     - {Number} The first index to start the search from.
                       Specify 0 to search the whole list.
            callback - {Function} (optional) A callback to make with the store
                       key. For compatibility with <O.RemoteQuery>.

        Returns:
            {Number} The index of the store key, or -1 if not found.
    */
    indexOfStoreKey ( storeKey, from, callback ) {
        const index = this._storeKeys.indexOf( storeKey, from );
        if ( callback ) {
            callback( index );
        }
        return index;
    },

    /**
        Method: O.LiveQuery#getObjectAt

        Returns the record at the index given in the query.

        Parameters:
            index - {Number} The index of the record to return.

        Returns:
            {O.Record} The record at index i in this array.
    */
    getObjectAt ( index ) {
        const storeKey = this._storeKeys[ index ];
        if ( storeKey ) {
            return this.get( 'store' )
                         .materialiseRecord( storeKey, this.get( 'Type' ) );
        }
    },

    /**
        Method: O.LiveQuery#refresh

        Asks the store to refresh the data for the type used in this query.

        Parameters:
            force - {Boolean} (optional) If true, the store will refresh the
                    data even if it thinks it is up to date.

        Returns:
            {O.LiveQuery} Returns self.
    */
    refresh ( force ) {
        this.get( 'store' ).fetchAll( this.get( 'Type' ), force );
        return this;
    },

    /**
        Method: O.LiveQuery#reset

        Recalculate the set of matching results.

        Returns:
            {O.LiveQuery} Returns self.
    */
    reset () {
        const oldStoreKeys = this._storeKeys;
        const storeKeys = this.get( 'store' ).findAll(
                this.get( 'Type' ), this.filter, this.sort );
        const maxLength = Math.max( storeKeys.length, oldStoreKeys.length );

        this._storeKeys = storeKeys;

        return this
            .beginPropertyChanges()
                .set( 'length', storeKeys.length )
                .rangeDidChange( 0, maxLength )
            .endPropertyChanges()
            .fire( 'query:reset' );
    },

    /**
        Method: O.LiveQuery#storeDidChangeRecords

        Callback made by the store when there are changes that affect the query.
        The query calculate the changes to make and fire any necessary
        observers/events.

        Parameters:
            storeKeysOfChanged - {Array} List of store keys that have changed
                                 which are of the type included in this query.

        Returns:
            {Boolean} Was there a change in the query results?
    */
    storeDidChangeRecords ( storeKeysOfChanged ) {
        const filter = this._filter;
        const sort = this._sort;
        const storeKeys = this._storeKeys;
        const added = [], addedIndexes = [];
        const removed = [], removedIndexes = [];
        const oldLength = this.get( 'length' );
        const store = this.get( 'store' );

        // 1. Find indexes of removed and ids of added
        // If it's changed, it's added to both.
        let l = storeKeysOfChanged.length;
        while ( l-- ) {
            const storeKey = storeKeysOfChanged[l];
            const index = storeKeys.indexOf( storeKey );
            const shouldBeInQuery = ( store.getStatus( storeKey ) & READY ) &&
                ( !filter || filter( storeKey ) );
            // If in query
            if ( index > -1 ) {
                // And should be in query
                if ( shouldBeInQuery ) {
                    // If there's a sort
                    if ( sort ) {
                        removedIndexes.push( index );
                        added.push( storeKey );
                    }
                }
                // And shouldn't be in query
                else {
                    removedIndexes.push( index );
                }
            }
            // If not in query
            else {
                // But should be
                if ( shouldBeInQuery ) {
                    added.push( storeKey );
                }
            }
        }

        let newStoreKeys, newLength, maxLength;
        let removedLength = removedIndexes.length;
        let addedLength = added.length;

        // 2. Sort removed indexes and find removed ids.
        if ( removedLength ) {
            removedIndexes.sort( numerically );
            for ( let i = 0; i < removedLength; i += 1 ) {
                removed[i] = storeKeys[ removedIndexes[i] ];
            }
        }

        // 3. Construct new array of store keys by merging sorted arrays
        if ( addedLength || removedLength ) {
            if ( addedLength && sort ) {
                added.sort( sort );
            }
            newLength = oldLength - removedLength + addedLength;
            newStoreKeys = new Array( newLength );
            for ( let i = 0, oi = 0, ri = 0, ai = 0; i < newLength; i += 1 ) {
                while ( ri < removedLength && oi === removedIndexes[ ri ] ) {
                    ri += 1;
                    oi += 1;
                }
                if ( sort && oi < oldLength && ai < addedLength ) {
                    const a = storeKeys[ oi ];
                    const b = added[ ai ];
                    if ( sort( a, b ) < 0 ) {
                        newStoreKeys[i] = a;
                        oi += 1;
                    } else {
                        newStoreKeys[i] = b;
                        addedIndexes[ ai ] = i;
                        ai += 1;
                    }
                } else if ( oi < oldLength ) {
                    newStoreKeys[i] = storeKeys[ oi ];
                    oi += 1;
                } else {
                    newStoreKeys[i] = added[ ai ];
                    addedIndexes[ ai ] = i;
                    ai += 1;
                }
            }
        }

        // 4. Sort added/addedIndexes arrays by index
        if ( addedLength ) {
            addedIndexes.sort( numerically );
            for ( let i = 0; i < addedLength; i += 1 ) {
                added[i] = newStoreKeys[ addedIndexes[i] ];
            }
        }

        // 5. Check if there are any redundant entries in the added/removed
        // lists
        l = Math.min( addedLength, removedLength );
        while ( l-- ) {
            if ( added[l] === removed[l] &&
                    addedIndexes[l] === removedIndexes[l] ) {
                added.splice( l, 1 );
                addedIndexes.splice( l, 1 );
                removed.splice( l, 1 );
                removedIndexes.splice( l, 1 );
                addedLength -= 1;
                removedLength -= 1;
            }
        }

        // 6. If there was an actual change, notify observers.
        if ( addedLength || removedLength ) {
            this._storeKeys = newStoreKeys;
            maxLength = Math.max( newLength, oldLength );
            this.beginPropertyChanges()
                .set( 'length', newLength )
                .rangeDidChange(
                    Math.min(
                        addedLength ? addedIndexes[0] : maxLength,
                        removedLength ? removedIndexes[0] : maxLength
                    ),
                    newLength === oldLength ?
                        Math.max(
                            addedLength ?
                                addedIndexes[ addedLength - 1 ] : 0,
                            removedLength ?
                                removedIndexes[ removedLength - 1 ] : 0
                        ) + 1 :
                        maxLength
                )
                .endPropertyChanges()
                .fire( 'query:updated', {
                    query: this,
                    removed,
                    removedIndexes,
                    added,
                    addedIndexes,
                });
            return true;
        }
        return false;
    },

    /**
        Method: O.LiveQuery#getStoreKeysForObjectsInRange

        Get a callback with an array of the store keys for all objects in the
        given range.

        Parameters:
            start    - {Number} The index of the first object to get the store
                       key for.
            end      - {Number} One past the index of the last object to get the
                       store key for.
            callback - {Function} This will be called with the array of store
                       keys as the first argument, the index of the first
                       returned result as the second argument, and one past the
                       index of the last result as the third argument.

        Returns:
            {Boolean} Always false. Represents whether the data is still loading
            (i.e. whether the callback has yet to be fired).
    */
    getStoreKeysForObjectsInRange ( start, end, callback ) {
        start = Math.max( 0, start );
        end = Math.min( this.get( 'length' ), end );
        callback( this._storeKeys.slice( start, end ), start, end );
        return false;
    },

    /**
        Method: O.LiveQuery#getStoreKeysForAllObjects

        Get a callback with an array of the store keys for all objects in the
        array.

        Parameters:
            callback - {Function} This will be called with the array of store
                       keys as the first argument, the index of the first
                       returned result as the second argument, and one past the
                       index of the last result as the third argument.

        Returns:
            {Boolean} Always false. Represents whether the data is still loading
            (i.e. whether the callback has yet to be fired).
    */
    getStoreKeysForAllObjects ( callback ) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        return this.getStoreKeysForObjectsInRange( 0, 0x7fffffff, callback );
    },
});

export default LiveQuery;
