// -------------------------------------------------------------------------- \\
// File: RPCSource.js                                                         \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Source.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var delta = function ( update, primaryKey ) {
    var records = update.records,
        changes = update.changes,
        i, l = records.length,
        delta = new Array( l ),
        data, filteredObj;

    for ( i = 0; i < l; i += 1 ) {
        data = records[i];
        filteredObj = Object.filter( data, changes[i] );
        filteredObj[ primaryKey ] = data[ primaryKey ];
        delta[i] = filteredObj;
    }
    return delta;
};

var handleProps = {
    precedence: 'commitPrecedence',
    fetch: 'recordFetchers',
    refresh: 'recordRefreshers',
    commit: 'recordCommitters',
    create: 'recordCreators',
    update: 'recordUpdaters',
    destroy: 'recordDestroyers',
    query: 'queryFetchers'
};

/**
    Class: O.RPCSource

    Extends: O.Source

    An RPCSource communicates with a server using a JSON protocol conformant
    with the [JMAP](http://jmap.io) standard, allowing multiple fetches and
    commits to be batched into a single HTTP request for efficiency, with
    requests for the same type of object grouped together.

    A request consists of a JSON array, with each element in the array being
    itself an array of three elements, the first a method name, the second an
    object consisting of named arguments, and the third a tag used to associate
    the request with the response:

        [
            [ 'method', {
                arg1: 'foo',
                arg2: 'bar'
            }, '#1' ],
            [ 'method2', {
                foo: [ 'an', 'array' ],
                bar: 42
            }, '#2' ]
        ]

    The response is expected to be in the same format, with methods from
    <O.RPCSource#response> available to the server to call.
*/
var RPCSource = NS.Class({

    Extends: NS.Source,

    /**
        Constructor: O.RPCSource

        Parameters:
            mixin - {Object} (optional) Any properties in this object will be
                    added to the new O.Object instance before initialisation (so
                    you can pass it getter/setter functions or observing
                    methods). If you don't specify this, your source isn't going
                    to do much!
    */
    init: function ( mixin ) {
        // List of method/args queued for sending in the next request.
        this._sendQueue = [];
        // List of callback functions to be executed after the next request.
        this._callbackQueue = [];

        // Map of Type name -> Id -> true
        // for all records to be fetched for that type.
        this._recordsToFetch = {};
        // Map of Type name -> Id -> true
        // for all records to be refreshed for that type.
        this._recordsToRefresh = {};
        // Map of id -> RemoteQuery for all queries to be fetched.
        this._queriesToFetch = {};

        this._inFlightRemoteCalls = null;
        this._inFlightCallbacks = null;

        this.inFlightRequest = null;

        RPCSource.parent.init.call( this, mixin );
    },

    /**
        Property: O.RPCSource#url
        Type: String

        The url to use for communicating with the server.
    */
    url: '/',

    /**
        Property: O.RPCSource#willRetry
        Type: Boolean

        If true, retry the request if the connection fails or times out.
    */
    willRetry: true,

    /**
        Property: O.RPCSource#timeout
        Type: Number

        Time in milliseconds at which to time out the request. Set to 0 for no
        timeout.
    */
    timeout: 30000,

    /**
        Property: O.RPCSource#inFlightRequest
        Type: (O.HttpRequest|null)

        The HttpRequest currently in flight.
    */
    inFlightRequest: null,

    /**
        Method: O.RPCSource#ioDidSucceed

        Callback when the IO succeeds. Parses the JSON and passes it on to
        <O.RPCSource#receive>.

        Parameters:
            event - {IOEvent}
    */
    ioDidSucceed: function ( event ) {
        // Parse data
        var data;
        try {
            data = JSON.parse( event.data );
        } catch ( error ) {}

        // Check it's in the correct format
        if ( !( data instanceof Array ) ) {
            NS.RunLoop.didError({
                name: 'O.RPCSource#ioDidSucceed',
                message: 'Data from server is not JSON.',
                details: 'Data:\n' + event.data +
                    '\n\nin reponse to request:\n' +
                    JSON.stringify( this._inFlightRemoteCalls, null, 2 )
            });
            data = [];
        }

        this.receive(
            data, this._inFlightCallbacks, this._inFlightRemoteCalls );

        this._inFlightRemoteCalls = this._inFlightCallbacks = null;
    }.on( 'io:success' ),

    /**
        Method: O.RPCSource#ioDidFail

        Callback when the IO fails.

        Parameters:
            event - {IOEvent}
    */
    ioDidFail: function (/* event */) {
        if ( !this.get( 'willRetry' ) ) {
            this._inFlightRemoteCalls = this._inFlightCallbacks = null;
        }
    }.on( 'io:failure', 'io:abort' ),

    /**
        Method: O.RPCSource#ioDidEnd

        Callback when the IO ends.

        Parameters:
            event - {IOEvent}
    */
    ioDidEnd: function ( event ) {
        // Send any waiting requests
        this.set( 'inFlightRequest', null )
            .send();
        // Destroy old HttpRequest object.
        event.target.destroy();
    }.on( 'io:end' ),

    /**
        Method: O.RPCSource#callMethod

        Add a method call to be sent on the next request and trigger a request
        to be sent at the end of the current run loop.

        Parameters:
            name     - {String} The name of the method to call.
            args     - {Object} The arguments for the method.
            callback - {Function} (optional) A callback to execute after the
                       request completes successfully.
    */
    callMethod: function ( name, args, callback ) {
        var id = this._sendQueue.length + '';
        this._sendQueue.push([ name, args || {}, id ]);
        if ( callback ) {
            this._callbackQueue.push([ id, callback ]);
        }
        this.send();
        return this;
    },

    /**
        Method: O.RPCSource#send

        Send any queued method calls at the end of the current run loop.
    */
    send: function () {
        if ( !this.get( 'inFlightRequest' ) ) {
            var remoteCalls = this._inFlightRemoteCalls,
                request;
            if ( !this._inFlightRemoteCalls ) {
                request = this.makeRequest();
                remoteCalls = request[0];
                if ( !remoteCalls.length ) { return; }
                this._inFlightRemoteCalls = remoteCalls;
                this._inFlightCallbacks = request[1];
            }

            this.set( 'inFlightRequest',
                new NS.HttpRequest({
                    nextEventTarget: this,
                    timeout: this.get( 'timeout' ),
                    method: 'POST',
                    url: this.get( 'url' ),
                    contentType: 'application/json',
                    data: JSON.stringify( remoteCalls )
                }).send()
            );
        }
    }.queue( 'after' ),

    /**
        Method: O.RPCSource#receive

        After completing a request, this method is be called to process the
        response returned by the server.

        Parameters:
            data        - {Array} The array of method calls to execute in
                          response to the request.
            callbacks   - {Array} The array of callbacks to execute after the
                          data has been processed.
            remoteCalls - {Array} The array of method calls that was executed on
                          the server.
    */
    receive: function ( data, callbacks, remoteCalls ) {
        var handlers = this.response,
            i, l, response, handler,
            remoteCallsLength,
            tuple, id, callback, request;
        for ( i = 0, l = data.length; i < l; i += 1 ) {
            response = data[i];
            handler = handlers[ response[0] ];
            if ( handler ) {
                id = response[2];
                request = remoteCalls[+id];
                try {
                    handler.call( this, response[1], request[0], request[1] );
                } catch ( error ) {
                    NS.RunLoop.didError( error );
                }
            }
        }
        // Invoke after bindings to ensure all data has propagated through.
        if ( l = callbacks.length ) {
            remoteCallsLength = remoteCalls.length;
            for ( i = 0; i < l; i += 1 ) {
                tuple = callbacks[i];
                id = tuple[0];
                callback = tuple[1];
                if ( id ) {
                    request = remoteCalls[+id];
                    /* jshint ignore:start */
                    response = data.filter( function ( call ) {
                        return call[2] === id;
                    });
                    /* jshint ignore:end */
                    callback = callback.bind( null, response, request );
                }
                NS.RunLoop.queueFn( 'middle', callback );
            }
        }
    },

    /**
        Method: O.RPCSource#makeRequest

        This will make calls to O.RPCSource#(record|query)(Fetchers|Refreshers)
        to add any final API calls to the send queue, then return a tuple of the
        queue of method calls and the list of callbacks.

        Returns:
            {Array} Tuple of method calls and callbacks.
    */
    makeRequest: function () {
        var sendQueue = this._sendQueue,
            callbacks = this._callbackQueue,
            _recordsToFetch = this._recordsToFetch,
            _recordsToRefresh = this._recordsToRefresh,
            _queriesToFetch = this._queriesToFetch,
            type, id, req, handler;

        // Query Fetches
        for ( id in _queriesToFetch ) {
            req = _queriesToFetch[ id ];
            handler = this.queryFetchers[ NS.guid( req.constructor ) ];
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

    /**
        Method: O.RPCSource#fetchRecord

        Fetches a particular record from the source. Just passes the call on to
        <O.RPCSource#fetchRecords>.

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

    /**
        Method: O.RPCSource#fetchAllRecords

        Fetches all records of a particular type from the source. Just passes
        the call on to <O.RPCSource#fetchRecords>.

        Parameters:
            Type     - {O.Class} The record type.
            state    - {(String|undefined)} The state to update from.
            callback - {Function} (optional) A callback to make after the fetch
                       completes.

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchAllRecords: function ( Type, state, callback ) {
        return state ?
            this.refreshRecords( Type, null, state, callback ) :
            this.fetchRecords( Type, null, callback );
    },

    /**
        Method: O.RPCSource#fetchRecords

        Fetches a set of records of a particular type from the source.

        Parameters:
            Type     - {O.Class} The record type.
            ids      - {(String[]|Object|null)} Either an array of record
                       ids to fetch, a custom object describing a query, or
                       null, indicating that all records of this type should be
                       fetched.
            callback - {Function} (optional) A callback to make after the record
                       fetch completes (successfully or unsuccessfully).

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchRecords: function ( Type, ids, callback ) {
        var typeId = NS.guid( Type ),
            handler = this.recordFetchers[ typeId ];
        if ( !handler ) {
            return false;
        }
        if ( typeof handler === 'string' ) {
            this.callMethod( handler );
        } else if ( ids instanceof Array ) {
            var reqs = this._recordsToFetch,
                set = reqs[ typeId ] || ( reqs[ typeId ] = {} ),
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
            this._callbackQueue.push([ '', callback ]);
        }
        this.send();
        return true;
    },

    /**
        Method: O.RPCSource#refreshRecord

        Fetches any new data for a record since the last fetch if a handler for
        the type is defined in <O.RPCSource#recordRefreshers>, or refetches the
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
        return this.refreshRecords( Type, [ id ], null, callback );
    },

    /**
        Method: O.RPCSource#refreshRecords

        Fetches any new data for a set of records since the last fetch if a
        handler for the type is defined in <O.RPCSource#recordRefreshers>, or
        refetches the whole records again if not.

        Parameters:
            Type     - {O.Class} The record type.
            ids      - {(String[]|Object|null)} An array of record ids, or
                       alternatively some custom object, which will be passed
                       straight through to the record refresher for that type
                       defined in <O.RPCSource#recordRefreshers>.
            callback - {Function} (optional) A callback to make after the record
                       fetch completes (successfully or unsuccessfully).

        Returns:
            {Boolean} Returns true if the source handled the refresh.
    */
    refreshRecords: function ( Type, ids, state, callback ) {
        var typeId = NS.guid( Type ),
            handler = this.recordRefreshers[ typeId ];
        if ( handler ) {
            if ( typeof handler === 'string' ) {
                this.callMethod( handler, { state: state });
            }
            else if ( ids instanceof Array ) {
                var reqs = this._recordsToRefresh,
                    set = reqs[ typeId ] || ( reqs[ typeId ] = {} ),
                    l = ids.length;
                while ( l-- ) {
                    set[ ids[l] ] = true;
                }
            } else {
                // Pass through object requests straight through to the
                // handler.
                handler.call( this, ids, state );
            }
            if ( callback ) {
                this._callbackQueue.push([ '', callback ]);
            }
            this.send();
        } else {
            // If we don't have a way to refresh just the mutable bits,
            // just re-fetch the whole thing.
            return this.fetchRecords( Type, ids, callback );
        }
        return true;
    },

    /**
        Property: O.RPCSource#commitPrecedence
        Type: String[Number]|null
        Default: null

        This is on optional mapping of type guids to a number indicating the
        order in which they are to be committed. Types with lower numbers will
        be committed first.
    */
    commitPrecedence: null,

    /**
        Method: O.RPCSource#commitChanges

        Commits a set of creates/updates/destroys to the source. These are
        specified in a single object, which has record type guids as keys and an
        object with create/update/destroy properties as values. Those properties
        have the following types:

        create  - `[ [ storeKeys... ], [ dataHashes... ] ]`
        update  - `[ [ storeKeys... ], [ dataHashes... ], [changedMap... ] ]`
        destroy - `[ [ storeKeys... ], [ ids... ] ]`

        Each subarray inside the 'create' array should be of the same length,
        with the store key at position 0 in the first array, for example,
        corresponding to the data object at position 0 in the second. The same
        applies to the update and destroy arrays.

        A changedMap, is a map of attribute names to a boolean value indicating
        whether that value has actually changed. Any properties in the data
        which are not in the changed map are presumed unchanged.

        An example call might look like:

            source.commitChanges({
                MyType: {
                    primaryKey: "id",
                    create: {
                        storeKeys: [ "sk1", "sk2" ],
                        records: [{ attr: val, attr2: val2 ...}, {...}]
                    },
                    update: {
                        storeKeys: [ "sk3", "sk4", ... ],
                        records: [{ id: "id3", attr: val ... }, {...}],
                        changes: [{ attr: true }, ... ]
                    },
                    destroy: {
                        storeKeys: [ "sk5", "sk6" ],
                        ids: [ "id5", "id6" ]
                    },
                    state: "i425m515233"
                },
                MyOtherType: {
                    ...
                }
            });

        Any types that are handled by the source are removed from the changes
        object (`delete changes[ typeId ]`); any unhandled types are left
        behind, so the object may be passed to several sources, with each
        handling their own types.

        In a RPC source, this method considers each type in the changes. If that
        type has a handler defined in <O.RPCSource#recordCommitters>, then this
        will be called with the create/update/destroy object as the sole
        argument, otherwise it will look for separate handlers in
        <O.RPCSource#recordCreators>, <O.RPCSource#recordUpdaters> and
        <O.RPCSource#recordDestroyers>. If handled by one of these, the method
        will remove the type from the changes object.

        Parameters:
            changes  - {Object} The creates/updates/destroys to commit.
            callback - {Function} (optional) A callback to make after the
                       changes have been committed.

        Returns:
            {Boolean} Returns true if any of the types were handled. The
            callback will only be called if the source is handling at least one
            of the types being committed.
    */
    commitChanges: function ( changes, callback ) {
        var types = Object.keys( changes ),
            l = types.length,
            precedence = this.commitPrecedence,
            handledAny = false,
            type, handler, handledType,
            change, create, update, destroy;

        if ( precedence ) {
            types.sort( function ( a, b ) {
                return ( precedence[b] || -1 ) - ( precedence[a] || -1 );
            });
        }

        while ( l-- ) {
            type = types[l];
            change = changes[ type ];
            handler = this.recordCommitters[ type ];
            handledType = false;
            create = change.create;
            update = change.update;
            destroy = change.destroy;
            if ( handler ) {
                if ( typeof handler === 'string' ) {
                    this.callMethod( handler, {
                        state: change.state,
                        create: Object.zip( create.storeKeys, create.records ),
                        update: Object.zip(
                            update.storeKeys, delta( update, change.primaryKey )
                        ),
                        destroy: Object.zip( destroy.storeKeys, destroy.ids )
                    });
                } else {
                    handler.call( this, change );
                }
                handledType = true;
            } else {
                handler = this.recordCreators[ type ];
                if ( handler ) {
                    handler.call( this, create.storeKeys, create.records );
                    handledType = true;
                }
                handler = this.recordUpdaters[ type ];
                if ( handler ) {
                    handler.call( this,
                        update.storeKeys, update.records, update.changes );
                    handledType = true;
                }
                handler = this.recordDestroyers[ type ];
                if ( handler ) {
                    handler.call( this, destroy.storeKeys, destroy.ids );
                    handledType = true;
                }
            }
            if ( handledType ) {
                delete changes[ type ];
            }
            handledAny = handledAny || handledType;
        }
        if ( handledAny && callback ) {
            this._callbackQueue.push([ '', callback ]);
        }
        return handledAny;
    },

    /**
        Method: O.RPCSource#fetchQuery

        Fetches the data for a remote query from the source.

        Parameters:
            query - {O.RemoteQuery} The query to fetch.

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchQuery: function ( query, callback ) {
        if ( !this.queryFetchers[ NS.guid( query.constructor ) ] ) {
            return false;
        }
        var id = query.get( 'id' );

        this._queriesToFetch[ id ] = query;

        if ( callback ) {
            this._callbackQueue.push([ '', callback ]);
        }
        this.send();
        return true;
    },

    /**
        Method: O.RPCSource#handle

        Helper method to register handlers for a particular type. The handler
        object may include methods with the following keys:

        - precedence: Add function to `commitPrecedence` handlers.
        - fetch: Add function to `recordFetchers` handlers.
        - refresh: Add function to `recordRefreshers` handlers.
        - commit: Add function to `recordCommitters` handlers.
        - create: Add function to `recordCreators` handlers.
        - update: Add function to `recordUpdaters` handlers.
        - destroy: Add function to `recordDestroyers` handlers.
        - query: Add function to `queryFetcher` handlers.

        Any other keys are presumed to be a response method name, and added
        to the `response object.

        Parameters:
            Type     - {O.Class} The type these handlers are for.
            handlers - {string[function]} The handlers. These are registered
                       as described above.

        Returns:
            {O.RPCSource} Returns self.
    */
    handle: function ( Type, handlers ) {
        var typeId = NS.guid( Type ),
            action, propName, isResponse, actionHandlers;
        for ( action in handlers ) {
            propName = handleProps[ action ];
            isResponse = !propName;
            if ( isResponse ) {
                propName = 'response';
            }
            actionHandlers = this[ propName ];
            if ( !this.hasOwnProperty( propName ) ) {
                this[ propName ] = actionHandlers =
                    Object.create( actionHandlers );
            }
            actionHandlers[ isResponse ? action : typeId ] = handlers[ action ];
        }
        return this;
    },

    /**
        Property: O.RPCSource#recordFetchers
        Type: String[Function]

        A map of type guids to functions which will fetch records of that type.
        The functions will be called with the source as 'this' and a list of ids
        or an object (passed straight through from your program) as the sole
        argument.
    */
    recordFetchers: {},

    /**
        Property: O.RPCSource#recordRefreshers
        Type: String[Function]

        A map of type guids to functions which will refresh records of that
        type. The functions will be called with the source as 'this' and a list
        of ids or an object (passed straight through from your program) as the
        sole argument.
    */
    recordRefreshers: {},

    /**
        Property: O.RPCSource#recordCommitters
        Type: String[Function]

        A map of type guids to functions which will commit all creates, updates
        and destroys requested for a particular record type.
    */
    recordCommitters: {},

    /**
        Property: O.RPCSource#recordCreators
        Type: String[Function]

        A map of type guids to functions which will commit creates for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:

        storeKeys - {String[]} A list of store keys.
        data      - {Object[]} A list of the corresponding data object for
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

    /**
        Property: O.RPCSource#recordUpdaters
        Type: String[Function]

        A map of type guids to functions which will commit updates for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:

        storeKeys - {String[]} A list of store keys.
        data      - {Object[]} A list of the corresponding data object for
                    each store key.
        changed   - {String[Boolean][]} A list of objects mapping attribute
                    names to a boolean value indicating whether that value has
                    actually changed. Any properties in the data has not in the
                    changed map may be presumed unchanged.

        Once the request has been made, the following callbacks must be made to
        the <O.Store> instance as appropriate:

        * <O.Store#sourceDidCommitUpdate> if there are any commited updates.
        * <O.Store#sourceDidNotUpdate> if there are any temporarily rejected
          updates.
        * <O.Store#sourceDidError> if there are any permanently rejected
          updates.
    */
    recordUpdaters: {},

    /**
        Property: O.RPCSource#recordDestroyers
        Type: String[Function]

        A map of type guids to functions which will commit destroys for a
        particular record type. The function will be called with the source as
        'this' and will get the following arguments:

        storeKeys - {String[]} A list of store keys.
        ids       - {String[]} A list of the corresponding record ids.

        Once the request has been made, the following callbacks must be made to
        the <O.Store> instance as appropriate:

        * <O.Store#sourceDidCommitDestroy> if there are any commited destroys.
        * <O.Store#sourceDidNotDestroy> if there are any temporarily rejected
          updates.
        * <O.Store#sourceDidError> if there are any permanently rejected
          updates.
    */
    recordDestroyers: {},

    /**
        Property: O.RPCSource#queryFetchers
        Type: String[Function]

        A map of query type guids to functions which will fetch the requested
        contents of that query. The function will be called with the source as
        'this' and the query as the sole argument.
    */
    queryFetchers: {},

    didFetch: function ( Type, args, isAll ) {
        var store = this.get( 'store' );
        store.sourceDidFetchRecords( Type, args.list, args.state, isAll );
        if ( args.notFound ) {
            store.sourceCouldNotFindRecords( Type, args.notFound );
        }
    },

    didFetchUpdates: function ( Type, args ) {
        this.get( 'store' )
            .sourceDidFetchUpdates( Type, args.changed, args.removed,
                args.oldState, args.newState );
    },

    didCommit: function ( Type, args ) {
        var store = this.get( 'store' ),
            list;

        if ( args.created ) {
            store.sourceDidCommitCreate( args.created );
        }
        if ( ( list = args.updated ) && list.length ) {
            store.sourceDidCommitUpdate( list );
        }
        if ( ( list = args.destroyed ) && list.length ) {
            store.sourceDidCommitDestroy( list );
        }
        if ( ( list = args.notCreated ) && list.length ) {
            store.sourceDidNotCreate( list );
        }
        if ( ( list = args.notUpdated ) && list.length ) {
            store.sourceDidNotUpdate( list );
        }
        if ( ( list = args.notDestroyed ) && list.length ) {
            store.sourceDidNotDestroy( list );
        }
        if ( ( list = args.error ) && list.length ) {
            store.sourceDidError( list );
        }
        if ( args.newState ) {
            store.sourceCommitDidChangeState(
                Type, args.oldState, args.newState );
        }
    },

    /**
        Property: O.RPCSource#response
        Type: String[Function]

        A map of method names to functions which the server can call in a
        response to return data to the client.
    */
    response: {}
});

NS.RPCSource = RPCSource;

}( O ) );
