/* Connection.js from https://github.com/jmapio/jmap-js with minor adaptations – MIT Licensed */

/*global console, alert */

import { Class, guid, isEqual, zip } from '/overture/core';
import { Source } from '/overture/datastore';
import { didError, queueFn } from '/overture/foundation';
import { localise as loc } from '/overture/localisation';
import { HttpRequest } from '/overture/io'

// const auth = JMAP.auth;

// ---

const applyPatch = function ( object, path, patch ) {
    let slash; let key;
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
    let key;
    let didPatch = false;
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
    let record; let change; let previous; let patches; let i; let l; let key;
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
    const create = change.create;
    const update = change.update;
    const destroy = change.destroy;
    const toCreate = create.storeKeys.length ?
        zip( create.storeKeys, create.records ) :
        undefined;
    const toUpdate = makeUpdate( change.primaryKey, update, noPatch, false );
    const toDestroy = destroy.ids.length ?
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
    Name: 'Connection',

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
        let methodResponses = event.data && event.data.methodResponses;
        if ( !methodResponses ) {
            didError({
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
        let discardRequest = false;
        const status = event.status;

        switch ( status ) {
        // 400: Bad Request
        // 413: Payload Too Large
        case 400:
        case 413: {
            const response = event.data;
            didError({
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
        }
        // 401: Unauthorized
        case 401:
            // auth.didLoseAuthentication()
            //     .connectionWillSend( this );
            break;
        // 404: Not Found
        case 404:
            // auth.fetchSessions()
            //     .connectionWillSend( this );
            break;
        // 429: Rate Limited
        // 502/503/504: Service Unavailable
        // Wait a bit then try again
        case 429:
        case 502: // Bad Gateway
        case 503: // Service Unavailable
        case 504: // Gateway Timeout
            // auth.connectionFailed( this, 30 );
            break;
        // 500: Internal Server Error
        case 500:
            alert( loc( 'Sorry, something went wrong' ) );
            discardRequest = true;
            break;
        // Presume a connection error. Try again if willRetry is set,
        // otherwise discard.
        default:
            if ( this.get( 'willRetry' ) ) {
                // auth.connectionFailed( this );
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
    callMethod ( name, args, callback ) {
        const id = this._sendQueue.length + '';
        this._sendQueue.push([ name, args || {}, id ]);
        if ( callback ) {
            this._callbackQueue.push([ id, callback ]);
        }
        this.send();
        return this;
    },

    getPreviousMethodId () {
        return ( this._sendQueue.length - 1 ) + '';
    },

    fetchType ( typeId, accountId, ids ) {
        this.callMethod( typeId + '/get', {
            accountId,
            ids,
        });
    },

    refreshType ( typeId, accountId, ids, state ) {
        const get = typeId + '/get';
        if ( ids ) {
            this.callMethod( get, {
                accountId,
                ids,
            });
        } else {
            const changes = typeId + '/changes';
            this.callMethod( changes, {
                accountId,
                sinceState: state,
                maxChanges: 100,
            });
            const methodId = this.getPreviousMethodId();
            this.callMethod( get, {
                accountId,
                '#ids': {
                    resultOf: methodId,
                    name: changes,
                    path: '/created',
                },
            });
            this.callMethod( get, {
                accountId,
                '#ids': {
                    resultOf: methodId,
                    name: changes,
                    path: '/updated',
                },
            });
        }
        return this;
    },

    commitType ( typeId, changes ) {
        const setRequest = makeSetRequest( changes, false );
        let moveFromAccount; let fromAccountId; let toAccountId;
        if ( setRequest ) {
            this.callMethod( typeId + '/set', setRequest );
        }
        if (( moveFromAccount = changes.moveFromAccount )) {
            toAccountId = changes.accountId;
            for ( fromAccountId in moveFromAccount ) {
                this.callMethod( typeId + '/copy', {
                    fromAccountId,
                    toAccountId,
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

    addCallback ( callback ) {
        this._callbackQueue.push([ '', callback ]);
        return this;
    },

    hasRequests () {
        let id;
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

        let remoteCalls = this.get( 'inFlightRemoteCalls' );
        let request;
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
    receive ( data, callbacks, remoteCalls ) {
        const handlers = this.response;
        for (let i = 0, l = data.length; i < l; i += 1 ) {
            const response = data[i];
            const handler = handlers[ response[0] ];
            if ( handler ) {
                const id = response[2];
                const request = remoteCalls[+id];
                try {
                    handler.call( this, response[1], request[0], request[1] );
                } catch ( error ) {
                    didError( error );
                }
            }
        }
        // Invoke after bindings to ensure all data has propagated through.
        let l;
        if (( l = callbacks.length )) {
            for (let i = 0; i < l; i += 1 ) {
                const tuple = callbacks[i];
                const id = tuple[0];
                let callback = tuple[1];
                if ( id ) {
                    const request = remoteCalls[+id];
                    /* jshint ignore:start */
                    const response = data.filter( ( call ) => {
                        return call[2] === id;
                    });
                    /* jshint ignore:end */
                    callback = callback.bind( null, response, request );
                }
                queueFn( 'middle', callback );
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
    makeRequest () {
        const sendQueue = this._sendQueue;
        const callbacks = this._callbackQueue;
        const recordRefreshers = this.recordRefreshers;
        const recordFetchers = this.recordFetchers;
        const _queriesToFetch = this._queriesToFetch;
        const _typesToRefresh = this._typesToRefresh;
        const _recordsToRefresh = this._recordsToRefresh;
        const _typesToFetch = this._typesToFetch;
        const _recordsToFetch = this._recordsToFetch;
        let typesToRefresh; let recordsToRefresh; let typesToFetch; let recordsToFetch;
        let accountId; let typeId; let id; let req; let state; let ids; let handler;

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
    fetchRecord ( accountId, Type, id, callback ) {
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
    fetchAllRecords ( accountId, Type, state, callback ) {
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
    refreshRecord ( accountId, Type, id, callback ) {
        return this._fetchRecords(
            accountId, Type, [ id ], callback, '', true );
    },

    _fetchRecords ( accountId, Type, ids, callback, state, refresh ) {
        const typeId = guid( Type );
        let handler = refresh ?
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
            const reqs = refresh ? this._recordsToRefresh : this._recordsToFetch;
            const account = reqs[ accountId ] || ( reqs[ accountId ] = {} );
            const set = account[ typeId ] || ( account[ typeId ] = {} );
            let l = ids.length;
            while ( l-- ) {
                set[ ids[l] ] = true;
            }
        } else if ( refresh ) {
            const typesToRefresh = this._typesToRefresh[ accountId ] ||
                ( this._typesToRefresh[ accountId ] = {} );
            typesToRefresh[ typeId ] = state;
        } else {
            const typesToFetch = this._typesToFetch[ accountId ] ||
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
    commitChanges ( changes, callback ) {
        const ids = Object.keys( changes );
        let l = ids.length;
        const precedence = this.commitPrecedence;
        let handledAny = false;
        let handler; let change; let id;

        if ( precedence ) {
            ids.sort( ( a, b ) => {
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
    fetchQuery ( query, callback ) {
        if ( !this.queryFetchers[ guid( query.constructor ) ] ) {
            return false;
        }
        const id = query.get( 'id' );

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
    handle ( Type, handlers ) {
        const typeId = guid( Type );
        let action; let propName; let isResponse; let actionHandlers;
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

    didFetch ( Type, args, isAll ) {
        const store = this.get( 'store' );
        const list = args.list;
        const state = args.state;
        const notFound = args.notFound;
        const accountId = args.accountId;
        if ( list ) {
            store.sourceDidFetchRecords( accountId, Type, list, state, isAll );
        }
        if ( notFound && notFound.length ) {
            store.sourceCouldNotFindRecords( accountId, Type, notFound );
        }
    },

    didFetchUpdates ( Type, args, hasDataForUpdated ) {
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

    didCommit ( Type, args ) {
        const store = this.get( 'store' );
        const accountId = args.accountId;
        const toStoreKey = store.getStoreKey.bind( store, accountId, Type );
        let list; let object;

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

    didCopy ( Type, args ) {
        const store = this.get( 'store' );
        let list; let object;
        if (( object = args.created )) {
            list = Object.keys( object );
            if ( list.length ) {
                store.sourceDidCommitUpdate( list )
                        .sourceDidFetchPartialRecords(
                        args.toAccountId,
                        Type,
                        zip(
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
        error ( args, reqName, reqArgs ) {
            const type = args.type;
                let method = 'error_' + reqName + '_' + type;
                const response = this.response;
            if ( !response[ method ] ) {
                method = 'error_' + type;
            }
            if ( response[ method ] ) {
                response[ method ].call( this, args, reqName, reqArgs );
            }
        },
        error_unknownMethod ( _, requestName ) {
            // eslint-disable-next-line no-console
            console.log( 'Unknown API call made: ' + requestName );
        },
        error_invalidArguments ( _, requestName, requestArgs ) {
            // eslint-disable-next-line no-console
            console.log( 'API call to ' + requestName +
                'made with invalid arguments: ', requestArgs );
        },
        error_anchorNotFound (/* args */) {
            // Don't need to do anything; it's only used for doing indexOf,
            // and it will just check that it doesn't have it.
        },
        error_accountNotFound () {
            // TODO: refetch accounts list.
        },
        error_accountReadOnly () {
            // TODO: refetch accounts list
        },
        error_accountNotSupportedByMethod () {
            // TODO: refetch accounts list
        },
    }
});

export {
    Connection,
    makeSetRequest,
    makePatches,
    applyPatch,
};
