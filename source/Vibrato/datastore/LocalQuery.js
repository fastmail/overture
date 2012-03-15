// -------------------------------------------------------------------------- \\
// File: LocalQuery.js                                                        \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Status.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

var Status = NS.Status,
    EMPTY = Status.EMPTY,
    LOADING = Status.LOADING,
    READY = Status.READY,
    DESTROYED = Status.DESTROYED;

var qid = 0;

/**
    Class: O.LocalQuery
    
    Extends: O.ObservableArray
    
    A LocalQuery instance can be treated as an observable array which
    automatically updates its contents to reflect a certain query on the store.
    A query consists of a particular type, a filter function and a sort order.
    Normally you will not create a LocalQuery instance yourself but get it by
    retrieving the query from the store.
 */
var LocalQuery = NS.Class({
    
    Extends: NS.ObservableArray,
    
    /**
        Property: O.LocalQuery#id
        Type: String

        A unique identifier for this query.
    */
    id: function () {
        return this.get( 'className' ) + '-query-' + ( qid += 1 );
    }.property(),
    
    /**
        Property: O.LocalQuery#filter
        Type: (Function|null)

        The function to filter records with.
    */
    filter: null,
    
    /**
        Property: O.LocalQuery#sort
        Type: (Function|null)

        The function to sort the records with.
    */
    sort: null,
    
    /**
        Property: O.LocalQuery#store
        Type: O.Store

        The store to query for records.
    */
    
    /**
        Property: O.LocalQuery#type
        Type: O.Class.<Record>
        
        The Record class constructor function for the type of the instances to
        include in this query.
    */
    
    /**
        Property: O.LocalQuery#status
        Type: O.Status
        
        Status of the query: EMPTY|READY|DESTROYED
    */
    status: EMPTY,
    
    /**
        Property: O.LocalQuery#className
        Type: String
        
        The string 'LocalQuery'. For introspection.
    */
    className: 'LocalQuery',
    
    /**
        Constructor: O.LocalQuery

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
        LocalQuery.parent.init.call( this );
        
        NS.extend( this, options );
        
        var sort = this.sort;
        if ( sort && !( sort instanceof Function ) ) {
            this.sort = NS.sortByProperties( sort );
        }
        
        this.get( 'store' ).addQuery( this );
        
        this.refresh();
    },
    
    /**
        Method: O.LocalQuery#destroy
        
        Call this method when you have finished with a local query to ensure it
        does not continue monitoring the store for changes and can be garbage
        collected.
    */
    destroy: function () {
        this.set( 'status', DESTROYED );
        this.get( 'store' ).removeQuery( this );
        LocalQuery.parent.destroy.call( this );
    },
    
    /**
        Method: O.LocalQuery#refresh
        
        Recalculates the results that should be included in the query to ensure
        it reflects any changes to the store. Normally this method is called
        automatically be the store whenever necessary.
        
        Returns:
            {O.LocalQuery} Returns self.
    */
    refresh: function () {
        var type = this.get( 'type' ),
            records = this.get( 'store' ).getAllLoadedRecords( type ),
            filter = this.get( 'filter' ),
            sort = this.get( 'sort' );
        
        if ( filter ) {
            records = records.filter( filter );
        }
        if ( sort ) {
            records.sort( sort );
        }
        this.set( '[]', records ).set( 'status', READY );
    },
    
    /**
        Method: O.LocalQuery#getIdsForObjectsInRange
        
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
        callback( this.slice( start, end ).map( function ( obj ) {
            return obj ? ( obj.get instanceof Function ?
                obj.get( 'id' ) : obj.id ) : obj;
        }), start, end );
        return false;
    },

    /**
        Method: O.LocalQuery#getIdsForAllObjects
        
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

NS.LocalQuery = LocalQuery;

}( O ) );