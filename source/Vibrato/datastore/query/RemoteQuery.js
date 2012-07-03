// -------------------------------------------------------------------------- \\
// File: RemoteQuery.js                                                       \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Record.js, Status.js                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS, undefined ) {

var Status = NS.Status,
    EMPTY = Status.EMPTY,
    READY = Status.READY,
    DESTROYED = Status.DESTROYED,
    NON_EXISTENT = Status.NON_EXISTENT,
    LOADING = Status.LOADING,
    OBSOLETE = Status.OBSOLETE;

var qid = 0;

/**
    Class: O.RemoteQuery

    Extends: O.Object

    Includes: O.Enumerable, O.ObservableRange

    A remote query is conceptually an array of records, where the contents of
    the array is calculated by a server rather than the client. In its simplest
    form, you would use remote query like this:

        var query = new O.RemoteQuery({
            store: TodoApp.store
            Type: TodoApp.TodoItem,
            filter: 'done',
            sort: 'dateAscending'
        });

    Your data source connected to the store must support the fetchQuery method
    (either directly or via a handler in the queryFetchers property). This
    should fetch the list of record ids that are the result of the query and
    pass this to the query via the sourceDidFetchQuery callback. To reduce round
    trips, you may also like to fetch the records themselves as part of this
    handler, but this is optional; if you do not, after the ids have been
    loaded, any observers will fetch the records they want from the query. This
    will in turn get them from the store, which will request any unloaded
    records from the source as normal.

    The sort and filter properties may have arbitrary value and type. They are
    there so your fetchQuery handler in source knows what to fetch. If they are
    changed, the query is refetched. The sort and filter properties in the
    object passed to the sourceDidFetchQuery callback must be identical to the
    current values in the query for the data to be accepted.

    The server may also return a state string, which represents the current
    state of the query. The source may then send this to the server if the query
    is refreshed; if there have been no changes, the server can then avoid
    sending back unneccessary data.

*/
var RemoteQuery = NS.Class({

    Extends: NS.Object,

    Mixin: [ NS.Enumerable, NS.ObservableRange ],

    id: function () {
        return this.get( 'className' ) + '-query-' + ( qid += 1 );
    }.property(),

    /**
        Property: O.RemoteQuery#className
        Type: String

        Class name for introspection.
    */
    className: 'RemoteQuery',

    /**
        Property: O.RemoteQuery#sort
        Type: String

        The sort order to use for this query.
    */
    sort: '',

    /**
        Property: O.RemoteQuery#filter
        Type: String

        Any filter to apply to the query.
    */
    filter: '',

    /**
        Property: O.RemoteQuery#state
        Type: String

        A state string from the server to allow the query to fetch updates.
    */
    state: '',

    /**
        Property: O.RemoteQuery#Type
        Type: O.Class

        The type of records this query contains.
    */
    Type: NS.Record,

    /**
        Property: O.RemoteQuery#status
        Type: O.Status

        The status of the query. Initially EMPTY, will be READY once it knows
        the number of records contained in the query and DESTROYED after you've
        finished with the query and called <O.RemoteQuery#destroy>. It may also
        have OBSOLETE and LOADING bits set as appropriate.
    */
    status: EMPTY,

    /**
        Method: O.RemoteQuery#setObsolete

        Sets the OBSOLETE bit on the query's status value.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    setObsolete: function () {
        return this.set( 'status', this.get( 'status' ) | OBSOLETE );
    },

    /**
        Method: O.RemoteQuery#setLoading

        Sets the LOADING bit on the query's status value.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    setLoading: function () {
        return this.set( 'status', this.get( 'status' ) | LOADING );
    },

    /**
        Constructor: O.RemoteQuery

        Parameters:
            options - {Object} (optional) Any properties in this object will be
                      added to the new O.RemoteQuery instance before
                      initialisation (so you can pass it getter/setter functions
                      or observing methods).
    */
    init: function ( options ) {
        RemoteQuery.parent.init.call( this, options );
        this._list = [];
        this.get( 'store' ).addQuery( this );
    },

    /**
        Method: O.RemoteQuery#destroy

        Sets the status to DESTROYED, deregisters the query with the store and
        removes bindings and path observers so the object may be garbage
        collected.
    */
    destroy: function () {
        this.set( 'status',
            ( this.get( 'status' ) & EMPTY ) ? NON_EXISTENT : DESTROYED );
        this.get( 'store' ).removeQuery( this );
        RemoteQuery.parent.destroy.call( this );
    },

    /**
        Method: O.RemoteQuery#refresh

        Update the query with any changes on the server.

        Parameters:
            force        - {Boolean} (optional) Unless this is true, the remote
                           query will only ask the source to fetch updates if it
                           is marked OBSOLETE and not marked LOADING.
            callback     - {Function} (optional) A callback to be made
                           when the refresh finishes.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    _refresh: false,
    refresh: function ( force, callback ) {
        var status = this.get( 'status' );
        if ( force || status === EMPTY ||
                ( ( status & OBSOLETE ) && !( status & LOADING ) ) ) {
            this.get( 'source' ).fetchQuery( this, callback );
            if ( status & READY ) {
                this._refresh = true;
            }
        } else if ( callback ) {
            callback();
        }
        return this;
    },

    /**
        Method: O.RemoteQuery#reset

        Resets the list, throwing away the id list, resetting the state string
        and setting the status to EMPTY. This is automatically triggered if the
        sort or filter properties change.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    reset: function ( _, _key ) {
        this._list.length = 0;

        this.set( 'state', '' );

        var length = this.get( 'length' );
        if ( _key !== 'sort' ) {
            this.set( 'status', EMPTY )
                .set( 'length', null );
        }
        this.rangeDidChange( 0, length );

        if ( _key ) {
            this.get( 'source' ).fetchQuery( this );
        }
        return this;
    }.observes( 'sort', 'filter' ),

    /**
        Method: O.RemoteQuery#getObjectAt

        Returns the record at the index given in the array, if loaded. It will
        also ensure the entire window that index is contained in is loaded and
        that the ids for the windows either side are loaded. If the index is in
        triggerPoint range of the end of the window, the adjacent window will
        be fully loaded, not just its ids.

        Parameters:
            index      - {Number} The index to return the record at.
            doNotFetch - {Boolean} (optional) If true, the
                         <fetchDataForObjectAt> method will not be called.

        Returns:
            {(O.Record|null|undefined)} If the requested index is negative or
            past the end of the array, undefined will be returned. Otherwise the
            record will be returned, or null if the id is not yet loaded.
    */
    getObjectAt: function ( index, doNotFetch ) {
        var length = this.get( 'length' );
        if ( length === null || index < 0 || index >= length ) {
            return undefined;
        }

        if ( !doNotFetch ) {
            doNotFetch = this.fetchDataForObjectAt( index );
        }

        var id = this._list[ index ];
        return id ?
            this.get( 'store' )
                .getRecord( this.get( 'Type' ), id, doNotFetch ) :
            null;
    },

    /**
        Method: O.RemoteQuery#fetchDataForObjectAt

        This method is called by <getObjectAt> before getting the id of the
        index given from the internal list and fetching the record from the
        store. By default this method does nothing, but subclasses may wish to
        override it to (pre)fetch certain data.

        Parameters:
            index - {Number} The index of the record being requested.

        Returns:
            {Boolean} Has the data for the object been fetched? If true, the
            store will be explicitly told not to fetch the data, as the fetching
            is being handled by the query.
    */
    fetchDataForObjectAt: function ( index ) {
        return false;
    },

    /**
        Property: O.RemoteQuery#length
        Type: (Number|null)

        The length of the list of records matching the query, or null if
        unknown.
    */
    length: null,

    /**
        Method: O.RemoteQuery#indexOfId

        Finds the index of an id in the query. Since the entire list may not be
        loaded, this data may have to be loaded from the server so you should
        rely on the callback if you need an accurate result. If the id is not
        found, the index returned will be -1.

        Parameters:
            id       - {String} The record id to find.
            from     - {Number} The first index to start the search from.
                       Specify 0 to search the whole list.
            callback - {Function} (optional) A callback to make with the id
                       when found.

        Returns:
            {Number} The index of the id, or -1 if not found.
    */
    indexOfId: function ( id, from, callback ) {
        var index = this._list.indexOf( id, from );
        if ( callback ) {
            if ( this.get( 'length' ) === null ) {
                this.get( 'source' ).fetchQuery( this, function () {
                    callback( this._list.indexOf( id, from ) );
                }.bind( this ) );
            } else {
                callback( index );
            }
        }
        return index;
    },

    /**
        Method: O.RemoteQuery#getIdsForObjectsInRange

        Makes a callback with a subset of the ids for records in this query.

        The start and end values will be constrained to be inside the bounds of
        the array. If length is not yet known or is 0, the callback will be made
        with an empty list and it will immediately return false. Otherwise it
        will attempt to fetch the ids and make the callback when they are
        fetched. If the callback happened before the function returns, false
        will be returned. Otherwise true will be returned. (i.e. the return
        value indicates whether we are still waiting for data).

        Parameters:
            start    - {Number} The index of the first record whose id is to be
                       returned.
            end      - {Number} One past the index of the last record to be
                       returned.
            callback - {Function} This will be called with the array of ids as
                       the first argument, the index of the first returned
                       result as the second argument, and one past the index
                       of the last result as the third argument.

        Returns:
            {Boolean} Is the data still loading? (i.e. this is true if the
            callback was not fired synchronously, but rather will be called
            asynchronously at a later point.)
    */
    getIdsForObjectsInRange: function ( start, end, callback ) {
        var length = this.get( 'length' );

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

    /**
        Method: O.RemoteQuery#getIdsForAllObjects

        Get a callback with an array of the id properties for all records in the
        query.

        Parameters:
            callback - {Function} This will be called with the array of ids as
                       the first argument, the index of the first returned
                       result as the second argument, and one past the index
                       of the last result as the third argument.

        Returns:
            {Boolean} Is the data still loading? (i.e. this is true if the
            callback was not fired synchronously, but rather will be called
            asynchronously at a later point.)
    */
    getIdsForAllObjects: function ( callback ) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        return this.getIdsForObjectsInRange( 0, 0x7fffffff, callback );
    },

    /**
        Method (private): O.RemoteQuery#_adjustIdFetches

        Modifies the id range to be returned in the callback to
        <O.RemoteQuery#getIdsForObjectsInRange> in response to an update from
        the server.

        We adjust the range being fetched mainly so that new records that are
        inserted at the top of the list during a selection are not selected.
        Otherwise you may hit select all then as soon as it's selected hit
        delete, but in the meantime a new record arrives at the top of the list;
        if this were included in the selection it may be accidentally deleted.

        Parameters:
            removed - {Array.<Number>} The list of indexes which were removed.
            added   - {Array.<Number>} The list of indexes where new records
                       were addded.
    */
    _adjustIdFetches: function ( event ) {
        var added = event.addedIndexes,
            removed = event.removedIndexes,
            _awaitingIdFetch = this._awaitingIdFetch;
        if ( _awaitingIdFetch ) {
            _awaitingIdFetch.forEach( function ( call ) {
                var start = call[0],
                    end = call[1],
                    index, i, l;

                for ( i = 0, l = removed.length; i < l; i += 1 ) {
                    index = removed[i];
                    if ( index < start ) { start -= 1; }
                    if ( index < end ) { end -= 1; }
                }

                for ( i = 0, l = added.length; i < l; i += 1 ) {
                    index = added[i];
                    if ( index <= start ) { start += 1; }
                    if ( index < end ) { end += 1; }
                }

                // Update waiting method call arguments
                call[0] = start;
                call[1] = end;
            });
        }
    }.on( 'query:updated' ),

    /**
        Method (private): O.RemoteQuery#_idsWereFetched

        This processes any waiting callbacks after a fetch has completed. There
        may be multiple packets arriving so this method is only invoked once per
        runloop, before bindings sync (which will be after all data packets have
        been delivered).
    */
    _idsWereFetched: function () {
        var _awaitingIdFetch = this._awaitingIdFetch;
        this._awaitingIdFetch = null;
        if ( _awaitingIdFetch ) {
            _awaitingIdFetch.forEach( function ( call ) {
                this.getIdsForObjectsInRange( call[0], call[1], call[2] );
            }, this );
        }
    }.queue( 'before' ).on( 'query:idsLoaded' ),

    /**
        Method: O.RemoteQuery#sourceWillFetchQuery

        The source should call this method just before it fetches the query. By
        default this function just sets the loading flag on the query, but
        subclasses may like to return an object reflecting exactly the what the
        source should fetch (see <O.WindowedRemoteQuery#sourceWillFetchQuery)
        for example.

        Returns:
            {Boolean} Does the list need refreshing or just fetching (the two
            cases may be the same, but can be handled separately if the server
            has an efficient way of calculating changes from the state).
    */
    sourceWillFetchQuery: function () {
        var refresh = this._refresh;
        this._refresh = false;
        this.setLoading();
        return refresh;
    },

    /**
        Method: O.RemoteQuery#sourceDidFetchQuery

        The source should call this method with the data returned from fetching
        the query. The single argument is an object which should contain the
        following properties:

        sort   - {String} The sort used for the query.
        filter - {String} The filter used for the query.
        idList - {Array.<String>} The ids of the records represented by this
                 query.
        state  - {String} (optional) A string representing the state of the
                 query on the server at the time of the fetch.

        Parameters:
            args - {Object} See description above.
    */
    sourceDidFetchQuery: function ( args ) {
        // User may have changed sort or filter in intervening time; presume the
        // value on the object is the right one, so if data doesn't match, just
        // ignore it.
        if ( this.get( 'sort' ) !== args.sort ||
                this.get( 'filter' ) !== args.filter ) {
            return;
        }

        this.set( 'state', args.state );

        // Could use a proper diffing algorithm to calculate added/removed
        // arrays, but probably not worth it.
        var oldList = this._list,
            list = this._list = args.idList,
            oldTotal = this.get( 'length' ),
            total = list.length,
            removedIndexes = [],
            removedIds = [],
            addedIndexes = [],
            addedIds = [],
            firstChange = 0,
            lastChangeNew = total - 1,
            lastChangeOld = ( oldTotal || 0 ) - 1,
            l = Math.min( total, oldTotal || 0 ),
            i;

        // Initial fetch, oldTotal === null
        if ( oldTotal !== null ) {
            while ( firstChange < l &&
                    list[ firstChange ] === oldList[ firstChange ] ) {
                firstChange += 1;
            }

            while ( lastChangeNew >= 0 && lastChangeOld >= 0 &&
                    ( list[ lastChangeNew ] === oldList[ lastChangeOld ] ) ) {
                lastChangeNew -= 1;
                lastChangeOld -= 1;
            }

            for ( i = firstChange; i <= lastChangeOld; i += 1 ) {
                removedIndexes.push( i );
                removedIds.push( oldList[i] );
            }

            for ( i = firstChange; i <= lastChangeNew; i += 1 ) {
                addedIndexes.push( i );
                addedIds.push( list[i] );
            }
        }

        this.beginPropertyChanges()
            .set( 'status', READY )
            .set( 'length', total )
            .rangeDidChange( firstChange, total === oldTotal ?
                lastChangeNew + 1 : Math.max( oldTotal || 0, total ) )
            .endPropertyChanges();

        if ( oldTotal !== null ) {
            this.fire( 'query:updated', {
                removed: removedIds,
                removedIndexes: removedIndexes,
                added: addedIds,
                addedIndexes: addedIndexes
            });
        }
        this.fire( 'query:idsLoaded' );
    }
});

NS.RemoteQuery = RemoteQuery;

}( this.O ) );
