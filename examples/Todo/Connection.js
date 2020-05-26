/* Connection.js from https://github.com/jmapio/jmap-js with minor adaptations  – MIT Licensed */

/*global O, JMAP, console, alert */

"use strict";

var JMAP = {};

( function ( JMAP, undefined ) {

const isEqual = O.isEqual;
const loc = O.loc;
const guid = O.guid;
const Class = O.Class;
const RunLoop = O.RunLoop;
const HttpRequest = O.HttpRequest;
const Source = O.Source;

const auth = JMAP.auth;

// ---

const applyPatch = function ( object, path, patch ) {
    var slash, key;
    while ( true ) {
        // Invalid patch; path does not exist
        if ( !object ) {
            return;
        }
        slash = path.indexOf( '/' );
        if ( slash > -1 ) {
            key = path.slice( 0, slash );
            path = path.slice( slash + 1 );
        } else {
            key = path;
        }
        key = key.replace( /~1/g, '/' ).replace( /~0/g, '~' );
        if ( slash > -1 ) {
            object = object[ key ];
        } else {
            if ( patch !== null ) {
                object[ key ] = patch;
            } else {
                delete object[ key ];
            }
            break;
        }
    }
};

const makePatches = function ( path, patches, original, current ) {
    var key;
    var didPatch = false;
    if ( original && current &&
            typeof current === 'object' && !( current instanceof Array ) ) {
        for ( key in current ) {
            didPatch = makePatches(
                path + '/' + key.replace( /~/g, '~0' ).replace( /\//g, '~1' ),
                patches,
                original[ key ],
                current[ key ]
            ) || didPatch;
        }
        for ( key in original ) {
            if ( !( key in current ) ) {
                didPatch = makePatches(
                    path + '/' +
                        key.replace( /~/g, '~0' ).replace( /\//g, '~1' ),
                    patches,
                    original[ key ],
                    null
                ) || didPatch;
            }
        }
    } else if ( !isEqual( original, current ) ) {
        patches[ path ] = current !== undefined ? current : null;
        didPatch = true;
    }
    return didPatch;
};

const makeUpdate = function ( primaryKey, update, noPatch, isCopy ) {
    const storeKeys = update.storeKeys;
    const records = update.records;
    const changes = update.changes;
    const committed = update.committed;
    const updates = {};
    var record, change, previous, patches, i, l, key;
    for ( i = 0, l = records.length; i < l; i +=1 ) {
        record = records[i];
        change = changes[i];
        previous = committed[i];
        patches = {};

        for ( key in change ) {
            if ( change[ key ] && key !== 'accountId' ) {
                if ( noPatch ) {
                    patches[ key ] = record[ key ];
                } else {
                    makePatches( key, patches, previous[ key ], record[ key ] );
                }
            }
        }
        if ( isCopy ) {
            patches[ primaryKey ] = record[ primaryKey ];
        }

        updates[ isCopy ? storeKeys[i] : record[ primaryKey ] ] = patches;
    }
    return Object.keys( updates ).length ? updates : undefined;
};

const makeSetRequest = function ( change, noPatch ) {
    var create = change.create;
    var update = change.update;
    var destroy = change.destroy;
    var toCreate = create.storeKeys.length ?
        Object.zip( create.storeKeys, create.records ) :
        undefined;
    var toUpdate = makeUpdate( change.primaryKey, update, noPatch, false );
    var toDestroy = destroy.ids.length ?
        destroy.ids :
        undefined;
    return toCreate || toUpdate || toDestroy ? {
        accountId: change.accountId,
        create: toCreate,
        update: toUpdate,
        destroy: toDestroy,
    } : null;
};

const handleProps = {
    precedence: 'commitPrecedence',
    fetch: 'recordFetchers',
    refresh: 'recordRefreshers',
    commit: 'recordCommitters',
    query: 'queryFetchers',
};

/**
    Class: JMAP.Connection

    Extends: O.Source

    An Connection communicates with a server using a JSON protocol conformant
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
    <JMAP.Connection#response> available to the server to call.
*/
const Connection = Class({

    Extends: Source,

    /**
        Constructor: JMAP.Connection

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

        // Map of id -> O.Query for all queries to be fetched.
        this._queriesToFetch = {};
        // Map of accountId -> guid( Type ) -> state
        this._typesToRefresh = {};
        // Map of accountId -> guid( Type ) -> Id -> true
        this._recordsToRefresh = {};
        // Map of accountId -> guid( Type ) -> null
        this._typesToFetch = {};
        // Map of accountId -> guid( Type ) -> Id -> true
        this._recordsToFetch = {};

        this.inFlightRemoteCalls = null;
        this.inFlightCallbacks = null;
        this.inFlightRequest = null;

        Connection.parent.constructor.call( this, mixin );
    },

    prettyPrint: false,

    /**
        Property: JMAP.Connection#willRetry
        Type: Boolean

        If true, retry the request if the connection fails or times out.
    */
    willRetry: true,

    /**
        Property: JMAP.Connection#timeout
        Type: Number

        Time in milliseconds at which to time out the request. Set to 0 for no
        timeout.
    */
    timeout: 30000,

    /**
        Property: JMAP.Connection#inFlightRequest
        Type: (O.HttpRequest|null)

        The HttpRequest currently in flight.
    */
    inFlightRequest: null,

    /**
        Method: JMAP.Connection#ioDidSucceed

        Callback when the IO succeeds. Parses the JSON and passes it on to
        <JMAP.Connection#receive>.

        Parameters:
            event - {IOEvent}
    */
    ioDidSucceed: function ( event ) {
        var methodResponses = event.data && event.data.methodResponses;
        if ( !methodResponses ) {
            RunLoop.didError({
                name: 'JMAP.Connection#ioDidSucceed',
                message: 'No method responses received.',
                details: 'Request:\n' +
                    JSON.stringify( this.get( 'inFlightRemoteCalls' ), null, 2 )
            });
            methodResponses = [];
        }

        this.receive(
            methodResponses,
            this.get( 'inFlightCallbacks' ),
            this.get( 'inFlightRemoteCalls' )
        );

        this.set( 'inFlightRemoteCalls', null )
            .set( 'inFlightCallbacks', null );
    }.on( 'io:success' ),

    /**
        Method: JMAP.Connection#ioDidFail

        Callback when the IO fails.

        Parameters:
            event - {IOEvent}
    */
    ioDidFail: function ( event ) {
        var discardRequest = false;
        var status = event.status;

        switch ( status ) {
        // 400: Bad Request
        // 413: Payload Too Large
        case 400:
        case 413:
            var response = event.data;
            RunLoop.didError({
                name: 'JMAP.Connection#ioDidFail',
                message: 'Bad request made: ' + status,
                details: 'Request was:\n' +
                    JSON.stringify(
                        this.get( 'inFlightRemoteCalls' ), null, 2 ) +
                    '\n\nResponse was:\n' +
                    ( response ? JSON.stringify( response, null, 2 ) :
                        '(no data, the response probably wasn’t valid JSON)' ),
            });
            discardRequest = true;
            break;
        // 401: Unauthorized
        case 401:
            auth.didLoseAuthentication()
                .connectionWillSend( this );
            break;
        // 404: Not Found
        case 404:
            auth.fetchSessions()
                .connectionWillSend( this );
            break;
        // 429: Rate Limited
        // 502/503/504: Service Unavailable
        // Wait a bit then try again
        case 429:
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
            auth.connectionFailed( this, 30 );
            break;
        // 500: Internal Server Error
        case 500:
            alert( loc( 'FEEDBACK_SERVER_FAILED' ) );
            discardRequest = true;
            break;
        // Presume a connection error. Try again if willRetry is set,
        // otherwise discard.
        default:
            if ( this.get( 'willRetry' ) ) {
                auth.connectionFailed( this );
            } else {
                discardRequest = true;
            }
        }

        if ( discardRequest ) {
            this.receive(
                [],
                this.get( 'inFlightCallbacks' ),
                this.get( 'inFlightRemoteCalls' )
            );

            this.set( 'inFlightRemoteCalls', null )
                .set( 'inFlightCallbacks', null );
        }
    }.on( 'io:failure', 'io:abort' ),

    /**
        Method: JMAP.Connection#ioDidEnd

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
        Method: JMAP.Connection#callMethod

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

    getPreviousMethodId: function () {
        return ( this._sendQueue.length - 1 ) + '';
    },

    fetchType: function ( typeId, accountId, ids ) {
        this.callMethod( typeId + '/get', {
            accountId: accountId,
            ids: ids,
        });
    },

    refreshType: function ( typeId, accountId, ids, state ) {
        var get = typeId + '/get';
        if ( ids ) {
            this.callMethod( get, {
                accountId: accountId,
                ids: ids,
            });
        } else {
            var changes = typeId + '/changes';
            this.callMethod( changes, {
                accountId: accountId,
                sinceState: state,
                maxChanges: 100,
            });
            var methodId = this.getPreviousMethodId();
            this.callMethod( get, {
                accountId: accountId,
                '#ids': {
                    resultOf: methodId,
                    name: changes,
                    path: '/created',
                },
            });
            this.callMethod( get, {
                accountId: accountId,
                '#ids': {
                    resultOf: methodId,
                    name: changes,
                    path: '/updated',
                },
            });
        }
        return this;
    },

    commitType: function ( typeId, changes ) {
        var setRequest = makeSetRequest( changes, false );
        var moveFromAccount, fromAccountId, toAccountId;
        if ( setRequest ) {
            this.callMethod( typeId + '/set', setRequest );
        }
        if (( moveFromAccount = changes.moveFromAccount )) {
            toAccountId = changes.accountId;
            for ( fromAccountId in moveFromAccount ) {
                this.callMethod( typeId + '/copy', {
                    fromAccountId: fromAccountId,
                    toAccountId: toAccountId,
                    create: makeUpdate(
                        changes.primaryKey,
                        moveFromAccount[ fromAccountId ],
                        true,
                        true
                    ),
                    onSuccessDestroyOriginal: true,
                });
            }
        }
    },

    addCallback: function ( callback ) {
        this._callbackQueue.push([ '', callback ]);
        return this;
    },

    hasRequests: function () {
        var id;
        if ( this.get( 'inFlightRemoteCalls' ) || this._sendQueue.length ) {
            return true;
        }
        for ( id in this._queriesToFetch ) {
            return true;
        }
        for ( id in this._recordsToFetch ) {
            return true;
        }
        for ( id in this._recordsToRefresh ) {
            return true;
        }
        return false;
    },

    headers: function () {
        return {
            'Content-type': 'application/json',
            'Accept': 'application/json',
        };
    }.property().nocache(),

    /**
        Method: JMAP.Connection#send

        Send any queued method calls at the end of the current run loop.
    */
    send: function () {
        if ( this.get( 'inFlightRequest' ) ) {
            return;
        }

        var remoteCalls = this.get( 'inFlightRemoteCalls' );
        var request;
        if ( !remoteCalls ) {
            request = this.makeRequest();
            remoteCalls = request[0];
            if ( !remoteCalls.length ) { return; }
            this.set( 'inFlightRemoteCalls', remoteCalls );
            this.set( 'inFlightCallbacks', request[1] );
        }

        this.set( 'inFlightRequest',
            new HttpRequest({
                nextEventTarget: this,
                timeout: this.get( 'timeout' ),
                method: 'POST',
                url: '/api/',
                headers: this.get( 'headers' ),
                withCredentials: true,
                responseType: 'json',
                data: JSON.stringify({
                    methodCalls: remoteCalls,
                }, null, this.get( 'prettyPrint' ) ? 2 : 0 ),
            }).send()
        );
    }.queue( 'after' ),

    /**
        Method: JMAP.Connection#receive

        After completing a request, this method is called to process the
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
        var handlers = this.response;
        var i, l, response, handler, tuple, id, callback, request;
        for ( i = 0, l = data.length; i < l; i += 1 ) {
            response = data[i];
            handler = handlers[ response[0] ];
            if ( handler ) {
                id = response[2];
                request = remoteCalls[+id];
                try {
                    handler.call( this, response[1], request[0], request[1] );
                } catch ( error ) {
                    RunLoop.didError( error );
                }
            }
        }
        // Invoke after bindings to ensure all data has propagated through.
        if (( l = callbacks.length )) {
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
                RunLoop.queueFn( 'middle', callback );
            }
        }
    },

    /**
        Method: JMAP.Connection#makeRequest

        This will make calls to JMAP.Connection#(record|query)(Fetchers|Refreshers)
        to add any final API calls to the send queue, then return a tuple of the
        queue of method calls and the list of callbacks.

        Returns:
            {Array} Tuple of method calls and callbacks.
    */
    makeRequest: function () {
        var sendQueue = this._sendQueue;
        var callbacks = this._callbackQueue;
        var recordRefreshers = this.recordRefreshers;
        var recordFetchers = this.recordFetchers;
        var _queriesToFetch = this._queriesToFetch;
        var _typesToRefresh = this._typesToRefresh;
        var _recordsToRefresh = this._recordsToRefresh;
        var _typesToFetch = this._typesToFetch;
        var _recordsToFetch = this._recordsToFetch;
        var typesToRefresh, recordsToRefresh, typesToFetch, recordsToFetch;
        var accountId, typeId, id, req, state, ids, handler;

        // Record Refreshers
        for ( accountId in _typesToRefresh ) {
            typesToRefresh = _typesToRefresh[ accountId ];
            if ( !accountId ) {
                accountId = undefined;
            }
            for ( typeId in typesToRefresh ) {
                state = typesToRefresh[ typeId ];
                handler = recordRefreshers[ typeId ];
                if ( typeof handler === 'string' ) {
                    this.refreshType( handler, accountId, null, state );
                } else {
                    handler.call( this, accountId, null, state );
                }
            }
        }
        for ( accountId in _recordsToRefresh ) {
            recordsToRefresh = _recordsToRefresh[ accountId ];
            if ( !accountId ) {
                accountId = undefined;
            }
            for ( typeId in recordsToRefresh ) {
                handler = recordRefreshers[ typeId ];
                ids = Object.keys( recordsToRefresh[ typeId ] );
                if ( typeof handler === 'string' ) {
                    this.fetchType( handler, accountId, ids );
                } else {
                    handler.call( this, accountId, ids );
                }
            }
        }

        // Query Fetches
        for ( id in _queriesToFetch ) {
            req = _queriesToFetch[ id ];
            handler = this.queryFetchers[ guid( req.constructor ) ];
            if ( handler ) {
                handler.call( this, req );
            }
        }

        // Record fetches
        for ( accountId in _typesToFetch ) {
            typesToFetch = _typesToFetch[ accountId ];
            if ( !accountId ) {
                accountId = undefined;
            }
            for ( typeId in typesToFetch ) {
                handler = recordFetchers[ typeId ];
                if ( typeof handler === 'string' ) {
                    this.fetchType( handler, accountId, null );
                } else {
                    handler.call( this, accountId, null );
                }
            }
        }
        for ( accountId in _recordsToFetch ) {
            recordsToFetch = _recordsToFetch[ accountId ];
            if ( !accountId ) {
                accountId = undefined;
            }
            for ( typeId in recordsToFetch ) {
                handler = recordFetchers[ typeId ];
                ids = Object.keys( recordsToFetch[ typeId ] );
                if ( typeof handler === 'string' ) {
                    this.fetchType( handler, accountId, ids );
                } else {
                    handler.call( this, accountId, ids );
                }
            }
        }

        // Any future requests will be added to a new queue.
        this._sendQueue = [];
        this._callbackQueue = [];

        this._queriesToFetch = {};
        this._typesToRefresh = {};
        this._recordsToRefresh = {};
        this._typesToFetch = {};
        this._recordsToFetch = {};

        return [ sendQueue, callbacks ];
    },

    // ---

    /**
        Method: JMAP.Connection#fetchRecord

        Fetches a particular record from the source. Just passes the call on to
        <JMAP.Connection#_fetchRecords>.

        Parameters:
            Type     - {O.Class} The record type.
            id       - {String} The record id.
            callback - {Function} (optional) A callback to make after the record
                        fetch completes (successfully or unsuccessfully).

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchRecord: function ( accountId, Type, id, callback ) {
        return this._fetchRecords(
            accountId, Type, [ id ], callback, '', false );
    },

    /**
        Method: JMAP.Connection#fetchAllRecords

        Fetches all records of a particular type from the source. Just passes
        the call on to <JMAP.Connection#_fetchRecords>.

        Parameters:
            Type     - {O.Class} The record type.
            state    - {(String|undefined)} The state to update from.
            callback - {Function} (optional) A callback to make after the fetch
                        completes.

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchAllRecords: function ( accountId, Type, state, callback ) {
        return this._fetchRecords(
            accountId, Type, null, callback, state || '', !!state );
    },

    /**
        Method: JMAP.Connection#refreshRecord

        Fetches any new data for a record since the last fetch if a handler for
        the type is defined in <JMAP.Connection#recordRefreshers>, or refetches the
        whole record if not.

        Parameters:
            Type     - {O.Class} The record type.
            id       - {String} The record id.
            callback - {Function} (optional) A callback to make after the record
                        refresh completes (successfully or unsuccessfully).

        Returns:
            {Boolean} Returns true if the source handled the refresh.
    */
    refreshRecord: function ( accountId, Type, id, callback ) {
        return this._fetchRecords(
            accountId, Type, [ id ], callback, '', true );
    },

    _fetchRecords: function ( accountId, Type, ids, callback, state, refresh ) {
        var typeId = guid( Type );
        var handler = refresh ?
                this.recordRefreshers[ typeId ] :
                this.recordFetchers[ typeId ];
        if ( refresh && !handler ) {
            refresh = false;
            handler = this.recordFetchers[ typeId ];
        }
        if ( !handler ) {
            return false;
        }
        if ( ids ) {
            var reqs = refresh ? this._recordsToRefresh : this._recordsToFetch;
            var account = reqs[ accountId ] || ( reqs[ accountId ] = {} );
            var set = account[ typeId ] || ( account[ typeId ] = {} );
            var l = ids.length;
            while ( l-- ) {
                set[ ids[l] ] = true;
            }
        } else if ( refresh ) {
            var typesToRefresh = this._typesToRefresh[ accountId ] ||
                ( this._typesToRefresh[ accountId ] = {} );
            typesToRefresh[ typeId ] = state;
        } else {
            var typesToFetch = this._typesToFetch[ accountId ] ||
                ( this._typesToFetch[ accountId ] = {} );
            typesToFetch[ typeId ] = null;
        }
        if ( callback ) {
            this._callbackQueue.push([ '', callback ]);
        }
        this.send();
        return true;
    },

    /**
        Property: JMAP.Connection#commitPrecedence
        Type: String[Number]|null
        Default: null

        This is on optional mapping of type guids to a number indicating the
        order in which they are to be committed. Types with lower numbers will
        be committed first.
    */
    commitPrecedence: null,

    /**
        Method: JMAP.Connection#commitChanges

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
                id: {
                    Type: Record,
                    typeId: 'Record',
                    accountId: '...',
                    primaryKey: 'id',
                    create: {
                        storeKeys: [ 'sk1', 'sk2' ],
                        records: [{ attr: val, attr2: val2 ...}, {...}],
                    },
                    update: {
                        storeKeys: [ 'sk3', 'sk4', ... ],
                        records:   [{ id: 'id3', attr: val2 ... }, {...}],
                        committed:  [{ id: 'id3', attr: val1 ... }, {...}],
                        changes:   [{ attr: true }, ... ],
                    },
                    moveFromAccount: { ... previous account id -> update ... },
                    destroy: {
                        storeKeys: [ 'sk5', 'sk6' ],
                        ids: [ 'id5', 'id6' ],
                    },
                    state: 'i425m515233',
                },
                id2: {
                    ...
                },
            });

        In a JMAP source, this method considers each type in the changes.
        If that type has a handler defined in
        <JMAP.Connection#recordCommitters>, then this will be called with the
        create/update/destroy object as the sole argument.

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
        var ids = Object.keys( changes );
        var l = ids.length;
        var precedence = this.commitPrecedence;
        var handledAny = false;
        var handler, change, id;

        if ( precedence ) {
            ids.sort( function ( a, b ) {
                return ( precedence[ changes[b].typeId ] || -1 ) -
                    ( precedence[ changes[a].typeId ] || -1 );
            });
        }

        while ( l-- ) {
            id = ids[l];
            change = changes[ id ];
            handler = this.recordCommitters[ change.typeId ];
            if ( handler ) {
                if ( typeof handler === 'string' ) {
                    this.commitType( handler, change );
                } else {
                    handler.call( this, change );
                }
                handledAny = true;
            }
        }
        if ( handledAny && callback ) {
            this._callbackQueue.push([ '', callback ]);
        }
        return handledAny;
    },

    /**
        Method: JMAP.Connection#fetchQuery

        Fetches the data for a remote query from the source.

        Parameters:
            query - {O.Query} The query to fetch.

        Returns:
            {Boolean} Returns true if the source handled the fetch.
    */
    fetchQuery: function ( query, callback ) {
        if ( !this.queryFetchers[ guid( query.constructor ) ] ) {
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
        Method: JMAP.Connection#handle

        Helper method to register handlers for a particular type. The handler
        object may include methods with the following keys:

        - precedence: Add function to `commitPrecedence` handlers.
        - fetch: Add function to `recordFetchers` handlers.
        - refresh: Add function to `recordRefreshers` handlers.
        - commit: Add function to `recordCommitters` handlers.
        - query: Add function to `queryFetcher` handlers.

        Any other keys are presumed to be a response method name, and added
        to the `response object.

        Parameters:
            Type     - {O.Class} The type these handlers are for.
            handlers - {string[function]} The handlers. These are registered
                       as described above.

        Returns:
            {JMAP.Connection} Returns self.
    */
    handle: function ( Type, handlers ) {
        var typeId = guid( Type );
        var action, propName, isResponse, actionHandlers;
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
        if ( Type ) {
            Type.source = this;
        }
        return this;
    },

    /**
        Property: JMAP.Connection#recordFetchers
        Type: String[Function]

        A map of type guids to functions which will fetch records of that type.
        The functions will be called with the source as 'this' and a list of ids
        or an object (passed straight through from your program) as the sole
        argument.
    */
    recordFetchers: {},

    /**
        Property: JMAP.Connection#recordRefreshers
        Type: String[Function]

        A map of type guids to functions which will refresh records of that
        type. The functions will be called with the source as 'this' and a list
        of ids or an object (passed straight through from your program) as the
        sole argument.
    */
    recordRefreshers: {},

    /**
        Property: JMAP.Connection#recordCommitters
        Type: String[Function]

        A map of type guids to functions which will commit all creates, updates
        and destroys requested for a particular record type.
    */
    recordCommitters: {},

    /**
        Property: JMAP.Connection#queryFetchers
        Type: String[Function]

        A map of query type guids to functions which will fetch the requested
        contents of that query. The function will be called with the source as
        'this' and the query as the sole argument.
    */
    queryFetchers: {},

    didFetch: function ( Type, args, isAll ) {
        var store = this.get( 'store' );
        var list = args.list;
        var state = args.state;
        var notFound = args.notFound;
        var accountId = args.accountId;
        if ( list ) {
            store.sourceDidFetchRecords( accountId, Type, list, state, isAll );
        }
        if ( notFound && notFound.length ) {
            store.sourceCouldNotFindRecords( accountId, Type, notFound );
        }
    },

    didFetchUpdates: function ( Type, args, hasDataForUpdated ) {
        this.get( 'store' )
            .sourceDidFetchUpdates(
                args.accountId,
                Type,
                hasDataForUpdated ? null : args.updated || null,
                args.destroyed || null,
                args.oldState,
                args.newState
            );
    },

    didCommit: function ( Type, args ) {
        var store = this.get( 'store' );
        var accountId = args.accountId;
        var toStoreKey = store.getStoreKey.bind( store, accountId, Type );
        var list, object;

        if ( ( object = args.created ) && Object.keys( object ).length ) {
            store.sourceDidCommitCreate( object );
        }
        if ( ( object = args.notCreated ) ) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidNotCreate( list, true, Object.values( object ) );
            }
        }
        if ( ( object = args.updated ) ) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidCommitUpdate( list.map( toStoreKey ) )
                        .sourceDidFetchPartialRecords( accountId, Type, object );
            }
        }
        if ( ( object = args.notUpdated ) ) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidNotUpdate(
                    list.map( toStoreKey ), true, Object.values( object ) );
            }
        }
        if ( ( list = args.destroyed ) && list.length ) {
            store.sourceDidCommitDestroy( list.map( toStoreKey ) );
        }
        if ( ( object = args.notDestroyed ) ) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidNotDestroy(
                    list.map( toStoreKey ), true, Object.values( object ) );
            }
        }
        if ( args.newState ) {
            store.sourceCommitDidChangeState(
                accountId, Type, args.oldState, args.newState );
        }
    },

    didCopy: function ( Type, args ) {
        var store = this.get( 'store' );
        var list, object;
        if (( object = args.created )) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidCommitUpdate( list )
                        .sourceDidFetchPartialRecords(
                        args.toAccountId,
                        Type,
                        Object.zip(
                            Object.keys( object )
                                    .map( store.getIdFromStoreKey.bind( store ) ),
                            Object.values( object )
                        )
                        );
            }
        }
        if (( object = args.notCreated )) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidNotUpdate( list, true, Object.values( object ) );
            }
        }
    },

    /**
        Property: JMAP.Connection#response
        Type: String[Function]

        A map of method names to functions which the server can call in a
        response to return data to the client.
    */
    response: {
        error: function ( args, reqName, reqArgs ) {
            var type = args.type,
                method = 'error_' + reqName + '_' + type,
                response = this.response;
            if ( !response[ method ] ) {
                method = 'error_' + type;
            }
            if ( response[ method ] ) {
                response[ method ].call( this, args, reqName, reqArgs );
            }
        },
        error_unknownMethod: function ( _, requestName ) {
            // eslint-disable-next-line no-console
            console.log( 'Unknown API call made: ' + requestName );
        },
        error_invalidArguments: function ( _, requestName, requestArgs ) {
            // eslint-disable-next-line no-console
            console.log( 'API call to ' + requestName +
                'made with invalid arguments: ', requestArgs );
        },
        error_anchorNotFound: function (/* args */) {
            // Don't need to do anything; it's only used for doing indexOf,
            // and it will just check that it doesn't have it.
        },
        error_accountNotFound: function () {
            // TODO: refetch accounts list.
        },
        error_accountReadOnly: function () {
            // TODO: refetch accounts list
        },
        error_accountNotSupportedByMethod: function () {
            // TODO: refetch accounts list
        },
    }
});

Connection.makeSetRequest = makeSetRequest;
Connection.makePatches = makePatches;
Connection.applyPatch = applyPatch;

JMAP.Connection = Connection;

}( JMAP ) );
    