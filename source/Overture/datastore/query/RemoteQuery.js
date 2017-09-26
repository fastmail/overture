import { Class, guid } from '../../core/Core';
import Obj from '../../foundation/Object';
import ObservableRange from '../../foundation/ObservableRange';
import Enumerable from '../../foundation/Enumerable';
import '../../foundation/EventTarget';  // For Function#on
import '../../foundation/ObservableProps';  // For Function#observes
import '../../foundation/RunLoop';  // For Function#queue
import '../../foundation/ComputedProps';  // For Function#property, #nocache

import Record from '../record/Record';
import {
    EMPTY,
    READY,
    DESTROYED,
    NON_EXISTENT,
    // LOADING => The list is being fetched from the server.
    LOADING,
    // OBSOLETE => The list may have changed on the server since the last fetch
    // was initiated.
    OBSOLETE,
} from '../record/Status';

/**
    Class: O.RemoteQuery

    Extends: O.Object

    Includes: O.Enumerable, O.ObservableRange

    A remote query is conceptually an array of records, where the contents of
    the array is calculated by a server rather than the client. In its simplest
    form, you would use remote query like this:

        const query = new O.RemoteQuery({
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
const RemoteQuery = Class({

    Extends: Obj,

    Mixin: [ Enumerable, ObservableRange ],

    id: function () {
        return guid( this );
    }.property().nocache(),

    /**
        Property: O.RemoteQuery#sort
        Type: *

        The sort order to use for this query.
    */
    sort: '',

    /**
        Property: O.RemoteQuery#filter
        Type: *

        Any filter to apply to the query.
    */
    filter: '',

    /**
        Property: O.RemoteQuery#state
        Type: String

        A state string from the server to allow the query to fetch updates and
        to determine if its list is invalid.
    */

    /**
        Property: O.RemoteQuery#Type
        Type: O.Class

        The type of records this query contains.
    */
    Type: Record,

    /**
        Property: O.RemoteQuery#store
        Type: O.Store
    */

    /**
        Property: O.RemoteQuery#source
        Type: O.Source
    */

    /**
        Property: O.RemoteQuery#status
        Type: O.Status

        The status of the query. Initially EMPTY, will be READY once it knows
        the number of records contained in the query and DESTROYED after you've
        finished with the query and called <O.RemoteQuery#destroy>. It may also
        have OBSOLETE and LOADING bits set as appropriate.
    */

    /**
        Method: O.RemoteQuery#is

        Checks whether the query has a particular status. You can also supply a
        union of statuses (e.g. `query.is(O.Status.OBSOLETE|O.Status.DIRTY)`),
        in which case it will return true if the query has *any* of these status
        bits set.

        Parameters:
            status - {O.Status} The status to check.

        Returns:
            {Boolean} True if the record has the queried status.
    */
    is ( status ) {
        return !!( this.get( 'status' ) & status );
    },

    /**
        Method: O.RemoteQuery#setObsolete

        Sets the OBSOLETE bit on the query's status value.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    setObsolete () {
        return this.set( 'status', this.get( 'status' ) | OBSOLETE );
    },

    /**
        Method: O.RemoteQuery#setLoading

        Sets the LOADING bit on the query's status value.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    setLoading () {
        return this.set( 'status', this.get( 'status' ) | LOADING );
    },

    /**
        Constructor: O.RemoteQuery

        Parameters:
            mixin - {Object} (optional) Any properties in this object will be
                    added to the new O.RemoteQuery instance before
                    initialisation (so you can pass it getter/setter functions
                    or observing methods).
    */
    init (/* ...mixins */) {
        this._list = [];
        this._awaitingIdFetch = [];
        this._refresh = false;

        this.state = '';
        this.status = EMPTY;
        this.length = null;

        RemoteQuery.parent.constructor.apply( this, arguments );

        this.get( 'store' ).addQuery( this );
    },

    /**
        Method: O.RemoteQuery#destroy

        Sets the status to DESTROYED, deregisters the query with the store and
        removes bindings and path observers so the object may be garbage
        collected.
    */
    destroy () {
        this.set( 'status', this.is( EMPTY ) ? NON_EXISTENT : DESTROYED );
        this.get( 'store' ).removeQuery( this );
        RemoteQuery.parent.destroy.call( this );
    },

    /**
        Method: O.RemoteQuery#refresh

        Update the query with any changes on the server.

        Parameters:
            force        - {Boolean} (optional) Unless this is true, the remote
                           query will only ask the source to fetch updates if it
                           is marked EMPTY or OBSOLETE.
            callback     - {Function} (optional) A callback to be made
                           when the refresh finishes.

        Returns:
            {O.RemoteQuery} Returns self.
    */
    refresh ( force, callback ) {
        const status = this.get( 'status' );
        if ( force || status === EMPTY || ( status & OBSOLETE ) ) {
            if ( status & READY ) {
                this._refresh = true;
            }
            this.get( 'source' ).fetchQuery( this, callback );
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
        const length = this.get( 'length' );

        this._list.length = 0;
        this._refresh = false;

        this.set( 'state', '' )
            .set( 'status', EMPTY )
            .set( 'length', null )
            .rangeDidChange( 0, length );

        if ( _key ) {
            this.get( 'source' ).fetchQuery( this );
        }

        return this.fire( 'query:reset' );
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
    getObjectAt ( index, doNotFetch ) {
        const length = this.get( 'length' );

        if ( length === null || index < 0 || index >= length ) {
            return undefined;
        }

        if ( !doNotFetch ) {
            doNotFetch = this.fetchDataForObjectAt( index );
        }

        const storeKey = this._list[ index ];
        return storeKey ?
            this.get( 'store' )
                .getRecord( this.get( 'Type' ), '#' + storeKey, doNotFetch ) :
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
    fetchDataForObjectAt (/* index */) {
        return false;
    },

    /**
        Property: O.RemoteQuery#length
        Type: (Number|null)

        The length of the list of records matching the query, or null if
        unknown.
    */

    /**
        Method: O.RemoteQuery#indexOfStoreKey

        Finds the index of a store key in the query. Since the entire list may
        not be loaded, this data may have to be loaded from the server so you
        should rely on the callback if you need an accurate result. If the id
        is not found, the index returned will be -1.

        Parameters:
            storeKey - {String} The record store key to find.
            from     - {Number} The first index to start the search from.
                       Specify 0 to search the whole list.
            callback - {Function} (optional) A callback to make with the store
                       key when found.

        Returns:
            {Number} The index of the store key, or -1 if not found.
    */
    indexOfStoreKey ( storeKey, from, callback ) {
        const index = this._list.indexOf( storeKey, from );
        if ( callback ) {
            if ( this.get( 'length' ) === null ) {
                this.get( 'source' ).fetchQuery( this, function () {
                    callback( this._list.indexOf( storeKey, from ) );
                }.bind( this ) );
            } else {
                callback( index );
            }
        }
        return index;
    },

    /**
        Method: O.RemoteQuery#getStoreKeysForObjectsInRange

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
    getStoreKeysForObjectsInRange ( start, end, callback ) {
        const length = this.get( 'length' );

        if ( length === null ) {
            this._awaitingIdFetch.push([ start, end, callback ]);
            this.refresh();
            return true;
        }

        if ( start < 0 ) { start = 0; }
        if ( end > length ) { end = length; }
        callback( this._list.slice( start, end ), start, end );

        return false;
    },

    /**
        Method: O.RemoteQuery#getStoreKeysForAllObjects

        Get a callback with an array of the store keys for all records in the
        query.

        Parameters:
            callback - {Function} This will be called with the array of store
                       keys as the first argument, the index of the first
                       returned result as the second argument, and one past the
                       index of the last result as the third argument.

        Returns:
            {Boolean} Is the data still loading? (i.e. this is true if the
            callback was not fired synchronously, but rather will be called
            asynchronously at a later point.)
    */
    getStoreKeysForAllObjects ( callback ) {
        // 0x7fffffff is the largest positive signed 32-bit number.
        return this.getStoreKeysForObjectsInRange( 0, 0x7fffffff, callback );
    },

    /**
        Method (private): O.RemoteQuery#_adjustIdFetches

        Modifies the id range to be returned in the callback to
        <O.RemoteQuery#getStoreKeysForObjectsInRange> in response to an update
        from the server.

        We adjust the range being fetched mainly so that new records that are
        inserted at the top of the list during a selection are not selected.
        Otherwise you may hit select all then hit delete as soon as it's
        selected, but in the meantime a new record arrives at the top of the
        list; if this were included in the selection it may be accidentally
        deleted.

        Parameters:
            removed - {Number[]} The list of indexes which were removed.
            added   - {Number[]} The list of indexes where new records
                       were addded.
    */
    _adjustIdFetches: function ( event ) {
        const added = event.addedIndexes;
        const removed = event.removedIndexes;
        const awaitingIdFetch = this._awaitingIdFetch;
        let i, l, call, start, end, j, ll, index;
        for ( i = 0, l = awaitingIdFetch.length; i < l; i += 1 ) {
            call = awaitingIdFetch[i];
            start = call[0];
            end = call[1];

            for ( j = 0, ll = removed.length; j < ll; j += 1 ) {
                index = removed[j];
                if ( index < start ) { start -= 1; }
                if ( index < end ) { end -= 1; }
            }

            for ( j = 0, ll = added.length; j < ll; j += 1 ) {
                index = added[j];
                if ( index <= start ) { start += 1; }
                if ( index < end ) { end += 1; }
            }

            // Update waiting method call arguments
            call[0] = start;
            call[1] = end;
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
        const awaitingIdFetch = this._awaitingIdFetch;
        if ( awaitingIdFetch.length ) {
            this._awaitingIdFetch = [];
            awaitingIdFetch.forEach( function ( call ) {
                this.getStoreKeysForObjectsInRange( call[0], call[1], call[2] );
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
    sourceWillFetchQuery () {
        const refresh = this._refresh;
        this._refresh = false;
        this.set( 'status',
            ( this.get( 'status' )|LOADING ) & ~OBSOLETE );
        return refresh;
    },

    /**
        Method: O.RemoteQuery#sourceDidFetchQuery

        The source should call this method with the data returned from fetching
        the query. The single argument is an object which should contain the
        following properties:

        sort   - {String} The sort used for the query.
        filter - {String} The filter used for the query.
        idList - {String[]} The ids of the records represented by this
                 query.
        state  - {String} (optional) A string representing the state of the
                 query on the server at the time of the fetch.

        Parameters:
            args - {Object} See description above.

        Returns:
            {RemoteQuery} Returns self.
    */
    sourceDidFetchQuery ( args ) {
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
        const store = this.get( 'store' );
        const toStoreKey = store.getStoreKey.bind( store, this.get( 'Type' ) );
        const oldList = this._list;
        const list = this._list = args.idList.map( toStoreKey );
        const oldTotal = this.get( 'length' );
        const total = list.length;
        const removedIndexes = [];
        const removedStoreKeys = [];
        const addedIndexes = [];
        const addedStoreKeys = [];
        let firstChange = 0;
        let lastChangeNew = total - 1;
        let lastChangeOld = ( oldTotal || 0 ) - 1;
        const l = Math.min( total, oldTotal || 0 );
        let i;

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
                removedStoreKeys.push( oldList[i] );
            }

            for ( i = firstChange; i <= lastChangeNew; i += 1 ) {
                addedIndexes.push( i );
                addedStoreKeys.push( list[i] );
            }
        }

        lastChangeNew = ( total === oldTotal ) ?
            lastChangeNew + 1 : Math.max( oldTotal || 0, total );

        this.beginPropertyChanges()
            .set( 'status', READY|( this.is( OBSOLETE ) ? OBSOLETE : 0 ) )
            .set( 'length', total );
        if ( firstChange < lastChangeNew ) {
            this.rangeDidChange( firstChange, lastChangeNew );
        }
        this.endPropertyChanges();

        if ( oldTotal !== null && firstChange < lastChangeNew ) {
            this.fire( 'query:updated', {
                query: this,
                removed: removedStoreKeys,
                removedIndexes,
                added: addedStoreKeys,
                addedIndexes,
            });
        }
        return this.fire( 'query:idsLoaded' );
    },
});

export default RemoteQuery;
