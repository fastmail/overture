// -------------------------------------------------------------------------- \\
// File: Source.js                                                            \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS ) {

/*
    Class: O.Source
    
    Extends: O.Object
    
    A source provides persistent storage for a set of records. Data is fetched
    and commited back to here by an instance of <O.Store>. To reduce the number
    of HTTP requests (a big speed win), requests are batched during a runloop
    and normally only dispatched at the end. Record requests of the same type
    are grouped together.
*/
var Source = NS.Class({
    
    Extends: NS.Object,
    
    /*
        Constructor: O.Source
        
        Parameters:
            options - {Object} (optional) Any properties in this object will be
                      added to the new O.Object instance before initialisation
                      (so you can pass it getter/setter functions or observing
                      methods). If you don't specify this, you're source isn't
                      going to do much!
    */
    init: function ( options ) {
        this._sendQueue = [];
        this._callbackQueue = [];
        
        // Type -> Id set.
        this._recordsToFetch = {};
        this._recordsToRefresh = {};
        
        this._queriesToFetch = {};
        
        Source.parent.init.call( this, options );
    },
    
    /*
        Method: O.Source#send
        
        Override this to actually dispatch a request. You probably want to make
        your method only invoke once per run loop, after the bindings have
        synced.
    */
    send: function () {},
    
    /*
        Method: O.Source#popRequest
        
        This will make calls to O.Source#(record|query)(Fetchers|Refreshers) to
        add any final API calls to the send queue, then return a tuple of the
        queue of method calls and the list of callbacks
        
        Returns:
            {Array} Tuple of method calls and callbacks.
    */
    popRequest: function () {
        var sendQueue = this._sendQueue,
            callbacks = this._callbackQueue,
            _recordsToFetch = this._recordsToFetch,
            _recordsToRefresh = this._recordsToRefresh,
            _queriesToFetch = this._queriesToFetch,
            type, id, req, handler;
        
        // Query Fetches
        for ( id in _queriesToFetch ) {
            req = _queriesToFetch[ id ];
            handler = this.queryFetchers[ req.className ];
            if ( handler ) {
                handler.call( this, req );
            }
        }
        
        // Record Refreshers
        for ( type in _recordsToRefresh ) {
            this.recordRefreshers[ type ].call(
                this, Object.keys( _recordsToRefresh[ type ] ) );
        }
        
        // Record fetches
        for ( type in _recordsToFetch ) {
            this.recordFetchers[ type ].call(
                this, Object.keys( _recordsToFetch[ type ] ) );
        }
                
        // Any future requests will be added to a new queue.
        this._sendQueue = [];
        this._callbackQueue = [];
        
        this._recordsToFetch = {};
        this._recordsToRefresh = {};
        this._queriesToFetch = {};
        
        return [ sendQueue, callbacks ];
    },
    
    // ---
    
    /*
        Method: O.Source#fetchRecord
        
        Fetches a particular record from the source
        
        Parameters:
            Type     - {O.Class} The record type.
            id       - {String} The record id.
            callback - {Function} (optional) A callback to make after the record
                       fetch completes (successfully or unsuccessfully).
        
        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchRecord: function ( Type, id, callback ) {
        return this.fetchRecords( Type, [ id ], callback );
    },
    
    /*
        Method: O.Source#fetchRecords
        
        Fetches a set of records of a particular type from the source.
        
        Parameters:
            Type     - {O.Class} The record type.
            ids      - {(Array.<String>|Object)} An array of record ids, or
                       alternatively some custom object, which will be passed
                       straight through to the record fetcher for that type
                       defined in <O.Source#recordFetchers>.
            callback - {Function} (optional) A callback to make after the record
                       fetch completes (successfully or unsuccessfully).
        
        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchRecords: function ( Type, ids, callback ) {
        var typeName = Type.className;
        if ( !this.recordFetchers[ typeName ] ) {
            return false;
        }
        if ( ids instanceof Array ) {
            var reqs = this._recordsToFetch,
                set = reqs[ typeName ] || ( reqs[ typeName ] = {} ),
                l = ids.length;
            while ( l-- ) {
                set[ ids[l] ] = true;
            }
        } else {
            // Pass through object requests straight through to the
            // handler.
            this.recordFetchers[ typeName ].call( this, ids );
        }
        if ( callback ) {
            this._callbackQueue.push( callback );
        }
        this.send();
        return true;
    },
    
    /*
        Method: O.Source#refreshRecord
        
        Fetches any new data for a record since the last fetch if a handler for
        the type is defined in <O.Source#recordRefreshers>, or refetches the
        whole record if not.
        
        Parameters:
            Type     - {O.Class} The record type.
            id       - {String} The record id.
            callback - {Function} (optional) A callback to make after the record
                       refresh completes (successfully or unsuccessfully).
        
        Returns:
            {Boolean} Returns true if the source handled the refresh.
    */
    refreshRecord: function ( Type, id, callback ) {
        return this.refreshRecords( Type, [ id ], callback );
    },
    
    /*
        Method: O.Source#refreshRecords
        
        Fetches any new data for a set of records since the last fetch if a
        handler for the type is defined in <O.Source#recordRefreshers>, or
        refetches the whole records again if not.
        
        Parameters:
            Type     - {O.Class} The record type.
            ids      - {Array.<(String>|Object)>} An array of record ids, or
                       alternatively some custom object, which will be passed
                       straight through to the record refresher for that type
                       defined in <O.Source#recordRefreshers>.
            callback - {Function} (optional) A callback to make after the record
                       fetch completes (successfully or unsuccessfully).
        
        Returns:
            {Boolean} Returns true if the source handled the refresh.
    */
    refreshRecords: function ( Type, ids, callback ) {
        var typeName = Type.className,
            handler;
        if ( handler = this.recordRefreshers[ typeName ] ) {
            if ( ids instanceof Array ) {
                var reqs = this._recordsToRefresh,
                    set = reqs[ typeName ] || ( reqs[ typeName ] = {} ),
                    l = ids.length;
                while ( l-- ) {
                    set[ ids[l] ] = true;
                }
            } else {
                // Pass through object requests straight through to the
                // handler.
                handler.call( this, ids );
            }
            if ( callback ) {
                this._callbackQueue.push( callback );
            }
        } else {
            // If we don't have a way to refresh just the mutable bits,
            // just re-fetch the whole thing.
            return this.fetchRecords( Type, ids, callback );
        }
        return true;
    },
    
    /*
        Property: O.Source#commitPrecedence
        Type: Object.<String,Number>|null
        
        This is on optional mapping of type names to a number indicating the
        order in which they are to be committed. Types with lower numbers will
        be committed first.
    */
    commitPrecedence: null,
    
    /*
        Method: O.Source#commitChanges
        
        Commits a set of creates/updates/destroys to the source. These are
        specified in a single object, which has record type names as keys and an
        object with create/update/destroy properties as values. Those properties
        have the following types:
        
        create  - `[ [ storeKeys... ], [ dataHashes... ] ]`
        update  - `[ [ storeKeys... ], [ dataHashes... ], [changedMap... ] ]`
        destroy - `[ [ storeKeys... ], [ ids... ] ]`
        
        Each subarray inside the 'create' array should be of the same length,
        with the store key at position 0 in the first array, for example,
        corresponding to the data hash at position 0 in the second. The same
        applies to the update and destroy arrays.
        
        A changedMap, is a map of attribute names to a boolean value indicating
        whether that value has actually changed. Any properties in the data has
        not in the changed map are presumed unchanged.
        
        The default implementation of this method considers each entry for a
        type. If that type has a handler defined in <O.Source#recordCommitters>,
        then this will be called with the create/update/destroy hash as the sole
        argument, otherwise it will look for separate handlers in
        <O.Source#recordCreators>, <O.Source#recordUpdaters> and
        <O.Source#recordDestroyers>.
        
        Any types that are handled by the source are removed from the changes
        object; any unhandled types are left behind, so the object may be passed
        to several sources, with each handling their own types.
        
        For example:
        
            source.commitChanges({
                MyType: {
                    create: [
                        [ 'sk1', 'sk2' ],
                        [ {attr: val, attr2: val2 ...}, {...} ]
                    ],
                    update: [
                        [ 'sk3', 'sk4' ],
                        [ {id: 'id3', attr3: val3, attr4: val4 ...}, {...} ],
                        [ {attr3: true } ]
                    ],
                    destroy: [
                        [ 'sk5', 'sk6' ],
                        [ 'id5', 'id6' ]
                    ]
                },
                MyOtherType: {
                    ...
                }
            });
        
        Parameters:
            changes - {Object} The creates/updates/destroys to commit.
        
        Returns:
            {O.Source} Returns self.
    */
    commitChanges: function ( changes ) {
        var types = Object.keys( changes ),
            l = types.length,
            precedence = this.commitPrecedence,
            type, handler, handled, change, args;
        
        if ( precedence ) {
            types.sort( function ( a, b ) {
                return ( precedence[b] || -1 ) - ( precedence[a] || -1 );
            });
        }
        
        while ( l-- ) {
            type = types[l];
            change = changes[ type ];
            handler = this.recordCommitters[ type ];
            handled = false;
            if ( handler ) {
                handler.call( this, change );
                handled = true;
            } else {
                handler = this.recordCreators[ type ];
                if ( handler ) {
                    args = change.create;
                    handler.call( this,
                        args.storeKeys, args.records );
                    handled = true;
                }
                handler = this.recordUpdaters[ type ];
                if ( handler ) {
                    args = change.update;
                    handler.call( this,
                        args.storeKeys, args.records, args.changes );
                    handled = true;
                }
                handler = this.recordDestroyers[ type ];
                if ( handler ) {
                    args = change.destroy;
                    handler.call( this, args.storeKeys, args.ids );
                    handled = true;
                }
            }
            if ( handled ) {
                delete changes[ type ];
            }
        }
        return this;
    },
    
    /*
        Method: O.Source#fetchQuery
        
        Fetches the data for a remote query from the source.
        
        Parameters:
            query - {O.RemoteQuery} The query to fetch.
        
        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchQuery: function ( query, callback ) {
        if ( !this.queryFetchers[ query.className ] ) {
            return false;
        }
        var id = query.get( 'id' );
        
        this._queriesToFetch[ id ] = query;
        
        if ( callback ) {
            this._callbackQueue.push( callback );
        }
        this.send();
        return true;
    },
    
    /*
        Property: O.Source#recordFetchers
        Type: Object.<String,Function>
        
        A map of type names to functions which will fetch records of that type.
        The functions will be called with the source as 'this' and a list of ids
        or an object (passed straight through from your program) as the sole
        argument.
    */
    recordFetchers: {},
    
    /*
        Property: O.Source#recordRefreshers
        Type: Object.<String,Function>
        
        A map of type names to functions which will refresh records of that
        type. The functions will be called with the source as 'this' and a list
        of ids or an object (passed straight through from your program) as the
        sole argument.
    */
    recordRefreshers: {},
    
    /*
        Property: O.Source#recordCommitters
        Type: Object.<String,Function>
        
        A map of type names to functions which will commit all creates, updates
        and destroys requested for a particular record type.
    */
    recordCommitters: {},
    
    /*
        Property: O.Source#recordCreators
        Type: Object.<String,Function>
        
        A map of type names to functions which will commit creates for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:
        
        storeKeys - {Array.<String>} A list of store keys.
        data      - {Array.<Object>} A list of the corresponding data object for
                    each store key.
        
        Once the request has been made, the following callbacks must be made to
        the <O.Store> instance as appropriate:
        
        * <O.Store#sourceDidCommitCreate> if there are any commited creates.
        * <O.Store#sourceDidNotCreate> if there are any temporarily rejected
          creates.
        * <O.Store#sourceDidError> if there are any permanently rejected
          creates.
    */
    recordCreators: {},
    
    /*
        Property: O.Source#recordUpdaters
        Type: Object.<String,Function>
        
        A map of type names to functions which will commit updates for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:
        
        storeKeys - {Array.<String>} A list of store keys.
        data      - {Array.<Object>} A list of the corresponding data object for
                    each store key.
        changed   - {Array.<Object.<String,Boolean>>} A list of objects mapping
                    attribute names to a boolean value indicating whether that
                    value has actually changed. Any properties in the data has
                    not in the changed map may be presumed unchanged.
        
        Once the request has been made, the following callbacks must be made to
        the <O.Store> instance as appropriate:
        
        * <O.Store#sourceDidCommitUpdate> if there are any commited updates.
        * <O.Store#sourceDidNotUpdate> if there are any temporarily rejected
          updates.
        * <O.Store#sourceDidError> if there are any permanently rejected
          updates.
    */
    recordUpdaters: {},
    
    /*
        Property: O.Source#recordDestroyers
        Type: Object.<String,Function>
        
        A map of type names to functions which will commit destroys for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:
        
        storeKeys - {Array.<String>} A list of store keys.
        ids       - {Array.<String>} A list of the corresponding record ids.
        
        Once the request has been made, the following callbacks must be made to
        the <O.Store> instance as appropriate:
        
        * <O.Store#sourceDidCommitDestroy> if there are any commited destroys.
        * <O.Store#sourceDidNotDestroy> if there are any temporarily rejected
          updates.
        * <O.Store#sourceDidError> if there are any permanently rejected
          updates.
    */
    recordDestroyers: {},
    
    /*
        Property: O.Source#queryFetchers
        Type: Object.<String,Function>
        
        A map of query type names to functions which will fetch the requested
        contents of that query. The function will be called with the source as
        'this' and the query as the sole argument.
    */
    queryFetchers: {}
});

NS.Source = Source;

}( O ) );