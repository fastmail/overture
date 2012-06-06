// -------------------------------------------------------------------------- \\
// File: RemotePagedQuery.js                                                  \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Status.js, RemoteQuery.js                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, OperaMail */

"use strict";

( function ( NS, undefined ) {

var Status = NS.Status,
    EMPTY = Status.EMPTY,
    READY = Status.READY,
    LOADING = Status.LOADING;

/**
    Class: O.RemotePagedQuery
    
    Extends: O.RemoteQuery
    
    A remote paged query represents an array of records fulfil certain
    criterion, calculated by the server, but for which the full result set may
    not be known. Random access is not allowed: only the next window of records
    may be loaded; the query will keep requesting new pages until it is returned
    less than a full window worth, at which point presumably the end has been
    reached.
*/
var RemotePagedQuery = NS.Class({
    
    Extends: NS.RemoteQuery,
    
    /**
        Property: O.RemotePagedQuery#className
        Type: String
        
        Class name for introspection.
    */
    className: 'RemotePagedQuery',
    
    /**
        Property: O.RemotePagedQuery#search
        Type: String
        
        Any search terms to apply to the query.
    */
    search: '',
    
    /**
        Property: O.RemotePagedQuery#complete
        Type: Boolean
        
        Has the complete list of record ids in this query been loaded?
    */
    complete: false,
    
    /**
        Property: O.RemotePagedQuery#windowSize
        Type: Number
        
        The number of records that make up one window.
    */
    windowSize: 30,
    
    /**
        Property: O.RemotePagedQuery#triggerPoint
        Type: Number
        
        If the record at an index less than this far from the end of a window is
        requested, the adjacent window will also be loaded (preloading based on
        locality)
    */
    triggerPoint: 1,
    
    /**
        Method: O.RemotePagedQuery#reset
        
        Resets the list, throwing away the id list and setting the status to
        <O.Status.EMPTY>. This is automatically triggered if the search, sort or
        filter properties change.
        
        Returns:
            {O.RemotePagedQuery} Returns self.
    */
    reset: function ( _, _key ) {
        var length = this.get( 'length' );
        
        this._list.length = 0;
        this.set( 'complete', false )
            .set( 'status', EMPTY )
            .set( 'length', null )
            .rangeDidChange( 0, length );
        
        if ( _key ) {
            this.get( 'source' ).fetchQuery( this );
        }
        return this;
    }.observes( 'search', 'sort', 'filter' ),
    
    fetchDataForObjectAt: function ( index ) {
        if ( index >= this.get( 'length' ) - this.triggerPoint ) {
            this.fetchNextWindow();
        }
        return true;
    },
    
    /**
        Method: O.RemotePagedQuery#fetchNextWindow
        
        Fetches the next window of records in the query, if not yet complete.
        
        Returns:
            {O.RemotePagedQuery} Returns self.
    */
    fetchNextWindow: function () {
        var status = this.get( 'status' );
        if ( !( status & LOADING ) && !this.get( 'complete' ) ) {
            this.get( 'source' ).fetchQuery( this );
        }
        return this;
    },

    getIdsForObjectsInRange: function ( start, end, callback ) {
        var length = this.get( 'length' );

        if ( this._windowSize ) {
            this.set( 'windowSize', this._windowSize );
            delete this._windowSize;
        }
        
        if ( length === null ) {
            ( this._awaitingIdFetch || ( this._awaitingIdFetch = [] ) ).push(
                [ start, end, callback ] );
            return true;
        }
        
        if ( start < 0 ) { start = 0 ; }
        if ( end > length ) { end = length; }
        callback( this._list.slice( start, end ), start, end );
        
        return false;
    },

    getIdsForAllObjects: function ( callback ) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        var MAX_INT = 0x7fffffff,
            windowSize = this.get( 'windowSize' );
        if ( !this.get( 'complete' ) ) {
            if ( windowSize !== MAX_INT ) {
                this._windowSize = windowSize;
                this.set( 'windowSize', MAX_INT );
                // Can't just call fetchNextWindow() and push the callback onto
                // _awaitingIdFetch, as if we already loading the next window,
                // the new loading request will be ignored and then when the
                // current request loads it will see the window size of max int
                // and think it has finished loading everything. So instead call
                // fetchQuery explicity and callback after that has finished.
                this.get( 'source' ).fetchQuery( this, function () {
                    this.getIdsForObjectsInRange( 0, MAX_INT, callback );
                }.bind( this ) );
            } else {
                ( this._awaitingIdFetch ||
                    ( this._awaitingIdFetch = [] ) ).push(
                        [ 0, MAX_INT, callback ] );
            }
            return true;
        }
        return this.getIdsForObjectsInRange( 0, MAX_INT, callback );
    },
    
    /**
        Method: O.RemotePagedQuery#removeItems
        
        Remove a set of ids from the query.
        
        Parameters:
            removed - {Array.<String>} Array of ids to remove.
        
        Returns:
            {O.RemotePagedQuery} Returns self.
    */
    removeItems: function ( removed ) {
        // --- Remove removed items from list ---
        
        var list = this._list,
            oldLength = this.get( 'length' ),
            firstChange = oldLength,
            l = removed.length,
            newLength = oldLength - l,
            removedIndexes = [],
            i;
        
        while ( l-- ) {
            i = list.indexOf( removed[l] );
            if ( i > -1 ) {
                // Remove entry from list.
                list.splice( i, 1 );
                // And move the marker for index of first change if lower.
                if ( i < firstChange ) { firstChange = i; }
                removedIndexes.push( i );
            }
        }
        
        // --- Update length ---
        
        if ( oldLength !== newLength ) {
            if ( !newLength && !this.get( 'complete' ) ) {
                this.fetchNextWindow();
                newLength = null;
            }
            this.set( 'length', newLength );
        }
        
        // --- Broadcast changes ---
                
        this.rangeDidChange( firstChange, oldLength );
        
        // For selection purposes, list view will need to know the ids of those
        // which were removed. Also, keyboard indicator will need to know the
        // indexes of those removed or added.
        this.fire( 'query:updated', {
            removed: removed,
            removedIndexes: removedIndexes,
            added: [],
            addedIndexes: []
        });
        return this;
    },
    
    /**
        Method: O.RemotePagedQuery#sourceDidFetchQuery
        
        The source should call this when it fetches the next window of the id
        list for this query. The args object should contain:
        
        search - {String} The search used.
        sort   - {String} The sort used.
        filter - {String} The filter used.
        idList - {Array.<String>} The list of ids.
        anchor - {String} The id of the record before this window starts.
        total  - {Number} The total number of records in the query.
        
        Parameters:
            args - {Object} The id list window. See above for details.
    */
    sourceDidFetchQuery: function ( args ) {
        // User may have changed search, sort or filter in intervening time;
        // presume the value on the object is the right one, so if data doesn't
        // match, just ignore it.
        if ( this.get( 'search' ) !== args.search ||
                this.get( 'sort' ) !== args.sort ||
                this.get( 'filter' ) !== args.filter ) {
            return;
        }
        
        // If either of these are different, the list has
        // changed since we last queried it, so we must get the intervening
        // updates first.
        this.set( 'status', READY );

        var list = this._list,
            oldLength = list.length,
            listLength = oldLength,
            start = this.indexOfId( args.anchor ) + 1 || listLength;
        
        // Append only; remove anything beyond the point of the anchor.
        if ( listLength > start ) {
            list.length = start;
        }
        
        Array.prototype.push.apply( list, args.idList );
        
        if ( args.idList.length < this.get( 'windowSize' ) ) {
            this.set( 'complete', true );
        }
        
        // All that's left is to inform observers of the changes.
        this.set( 'length', listLength = list.length )
            .rangeDidChange( start, Math.max( listLength, oldLength ) )
            .fire( 'query:idsLoaded' );
    },
    
    /**
        Method: O.RemotePagedQuery#indexOfId
        
        Finds the index of an id in the currently loaded query.
        
        Parameters:
            id       - {String} The record id to find.
            from     - {Number} (optional) The first index to start the search
                       from. Specify 0 to search the whole list.
            callback - {Function} (optional) The callback to make with the id
                       when found.
        
        Returns:
            {Number} The index of the id, or -1 if not found.
    */
    indexOfId: function ( id, from, callback ) {
        var index = this._list.indexOf( id, from );
        if ( callback ) { callback( index ); }
        return index;
    }
});

NS.RemotePagedQuery = RemotePagedQuery;

}( O ) );