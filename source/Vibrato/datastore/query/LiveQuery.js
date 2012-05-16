// -------------------------------------------------------------------------- \\
// File: LiveQuery.js                                                        \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Status.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var Status = NS.Status,
    READY = Status.READY,
    DESTROYED = Status.DESTROYED;

var qid = 0;

var findPositionFor = function ( array, comparator, item ) {
    var upper = array.length,
        lower = 0,
        middle, itemAtMiddle;
    
    // Binary search.
    while ( lower < upper ) {
        middle = ( lower + upper ) >> 1;
        itemAtMiddle = array[ middle ];
        if ( item === itemAtMiddle ) {
            return middle;
        }
        if ( comparator( item, itemAtMiddle ) > 0 ) {
            lower = middle + 1;
        } else {
            upper = middle;
        }
    }
    return lower;
};

/**
    Class: O.LiveQuery
    
    Extends: O.Object
    
    A LiveQuery instance can be treated as an observable array which
    automatically updates its contents to reflect a certain query on the store.
    A query consists of a particular type, a filter function and a sort order.
    Normally you will not create a LiveQuery instance yourself but get it by
    retrieving the query from the store.
 */
var LiveQuery = NS.Class({
    
    Extends: NS.Object,
    
    Mixin: [ NS.ObservableRange, NS.Enumerable ],
    
    /**
        Property: O.LiveQuery#id
        Type: String

        A unique identifier for this query.
    */
    id: function () {
        return this.get( 'className' ) + '-query-' + ( qid += 1 );
    }.property(),
    
    /**
        Property (private): O.LiveQuery#_filter
        Type: (Function|null)

        The function to filter data objects with.
    */
    _filter: null,
    
    /**
        Property (private): O.LiveQuery#_sort
        Type: (Function|null)

        The function to sort the data objects with.
    */
    _sort: null,
    
    /**
        Property: O.LiveQuery#store
        Type: O.Store

        The store to query for records.
    */
    
    /**
        Property: O.LiveQuery#type
        Type: O.Class.<Record>
        
        The Record class constructor function for the type of the instances to
        include in this query.
    */
    
    /**
        Property: O.LiveQuery#status
        Type: O.Status
        
        Status of the query: READY|DESTROYED
    */
    status: READY,
    
    /**
        Property: O.LiveQuery#className
        Type: String
        
        The string 'LiveQuery'. For introspection.
    */
    className: 'LiveQuery',
    
    /**
        Constructor: O.LiveQuery

        The following options should be configured:

        store  - {O.Store} The store to query for records.
        type   - {O.Class} The constructor for the record type this query is a
                 collection of.
        filter - {Function} (optional) If supplied, only records which this
                 function returns a truthy value for are included in the
                 results.
        sort   - {(String|Array.<String>|Function)} (optional) The records in
                 the local query are sorted according to this named property. If
                 an array is supplied, in the case of a tie the next property in
                 the array will be consulted. If a function is supplied, this is
                 used as the sort function directly on the records. If nothing
                 is supplied, the results are not guaranteed to be in any
                 particular order.

        Parameters:
            options - {Object} The options for the query.
    */
    init: function ( options ) {
        var sort = options.sort,
            store = options.store || this.store;
        
        if ( sort && !( sort instanceof Function ) ) {
            options.sort = NS.sortByProperties( sort );
        }
        var results = store.find( options );
        
        this._storeKeys = results;
        this._sort = results.sortFn;
        this._filter = results.filterFn;
        
        this.length = results.length;
        this.type = options.type;
        this.store = store;
        
        LiveQuery.parent.init.call( this );
        
        store.addQuery( this );
    },
    
    /**
        Method: O.LiveQuery#destroy
        
        Call this method when you have finished with a local query to ensure it
        does not continue monitoring the store for changes and can be garbage
        collected.
    */
    destroy: function () {
        this.set( 'status', DESTROYED );
        this.get( 'store' ).removeQuery( this );
        LiveQuery.parent.destroy.call( this );
    },
    
    /**
        Property: O.LiveQuery#[]
        Type: Array
        
        A standard array of record objects for the records in this query.
    */
    '[]': function () {
        var store = this.get( 'store' ),
            type = this.get( 'type' );
        return this._storeKeys.map( function ( storeKey ) {
            return store.materialiseRecord( storeKey, type );
        });
    }.property(),
    
    /**
        Property: O.LiveQuery#length
        Type: Number
        
        The number of records in the query.
    */
    length: 0,
    
    /**
        Method: O.LiveQuery#getObjectAt
     
        Returns the record at the index given in the query.
        
        Parameters:
            index - {Number} The index of the record to return.
        
        Returns:
            {O.Record} The record at index i in this array.
    */
    getObjectAt: function ( index ) {
        var storeKey = this._storeKeys[ index ],
            record;
        if ( storeKey ) {
            record = this.get( 'store' )
                         .materialiseRecord( storeKey, this.get( 'type' ) );
        }
        return record;
    },
    
    /**
        Method: O.LiveQuery#storeDidChangeRecords
     
        Callback made by the store when there are changes that affect the query.
        The query calculate the changes to make and fire any necessary
        observers/events.
        
        Parameters:
            storeKeysOfChanged - {Array} List of store keys that have changed
            which are of the type included in this query.
    */
    storeDidChangeRecords: function ( storeKeysOfChanged ) {
        var filter = this._filter,
            sort = this._sort,
            storeKeys = this._storeKeys,
            added = [], addedIndexes,
            removed, removedIndexes = [],
            oldLength = this.get( 'length' ),
            store = this.get( 'store' ),
            storeKeyToId = function ( storeKey ) {
                return store.getIdFromStoreKey( storeKey );
            },
            l, storeKey, index, shouldBeInQuery,
            addedLength, removedLength, length, maxLength;
        
        l = storeKeysOfChanged.length;
        while ( l-- ) {
            storeKey = storeKeysOfChanged[l];
            index = storeKeys.indexOf( storeKey );
            shouldBeInQuery = ( store.getStatus( storeKey ) & READY ) &&
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
        
        removedLength = removedIndexes.length;
        addedLength = added.length;
        
        if ( removedLength ) {
            removedIndexes.sort();
            l = removedLength;
            removed = new Array( removedLength );
            while ( l-- ) {
                index = removedIndexes[l];
                removed[l] = storeKeys[ index ];
                storeKeys.splice( index, 1 );
            }
        } else {
            removed = [];
        }
        
        if ( addedLength ) {
            storeKeys.push.apply( storeKeys, added );
            if ( sort ) {
                storeKeys.sort( sort );
                addedIndexes = added.map(
                    findPositionFor.bind( null, storeKeys, sort )
                );
            } else {
                addedIndexes = added.map( function ( _, i ) {
                    return oldLength + i;
                });
            }
        } else {
            addedIndexes = [];
        }
        
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
        
        if ( addedLength || removedLength ) {
            length = oldLength + addedLength - removedLength;
            maxLength = Math.max( length, oldLength );
            
            this.beginPropertyChanges()
                .set( 'length', length )
                .rangeDidChange(
                    Math.min(
                        addedLength ? addedIndexes[0] : maxLength,
                        removedLength ? removedIndexes[0] : maxLength
                    ),
                    length === oldLength ?
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
                    removed: removed.map( storeKeyToId ),
                    removedIndexes: removedIndexes,
                    added: added.map( storeKeyToId ),
                    addedIndexes: addedIndexes
                });
        }
    },
    
    /**
        Method: O.LiveQuery#getIdsForObjectsInRange
        
        Get a callback with an array of the id properties for all objects in the
        range given.
        
        Parameters:
            start    - {Number} The index of the first object to get an id for.
            end      - {Number} One past the index of the last object to get an
                       id for.
            callback - {Function} This will be called with the array of ids as
                       the first argument, the index of the first returned
                       result as the second argument, and one past the index
                       of the last result as the third argument.
        
        Returns:
            {Boolean} Always false. Represents whether the data is still loading
            (i.e. whether the callback has yet to be fired).
    */
    getIdsForObjectsInRange: function ( start, end, callback ) {
        start = Math.max( 0, start );
        end = Math.min( this.get( 'length' ), end );
        var store = this.get( 'store' );
        callback( this._storeKeys.slice( start, end )
                                 .map( function ( storeKey ) {
            return store.getIdFromStoreKey( storeKey );
        }), start, end );
        return false;
    },

    /**
        Method: O.LiveQuery#getIdsForAllObjects
        
        Get a callback with an array of the id properties for all objects in the
        array.
        
        Parameters:
            callback - {Function} This will be called with the array of ids as
                       the first argument, the index of the first returned
                       result as the second argument, and one past the index
                       of the last result as the third argument.
        
        Returns:
            {Boolean} Always false. Represents whether the data is still loading
            (i.e. whether the callback has yet to be fired).
    */
    getIdsForAllObjects: function ( callback ) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        return this.getIdsForObjectsInRange( 0, 0x7fffffff, callback );
    }
});

NS.LiveQuery = LiveQuery;

}( O ) );