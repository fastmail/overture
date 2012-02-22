// -------------------------------------------------------------------------- \\
// File: IO.js                                                                \\
// Module: IO                                                                 \\
// Requires: Core, Foundation, XHR.js                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

"use strict";

/**
    Module: IO

    The IO module provides classes for two-way communication with a server.
*/

( function ( NS ) {

/**
    Class: O.IO
    
    Extends: O.Object
    
    IO is a powerful class for communicating with a server. It supports multiple
    transport mechanisms and concurrent connections.
*/

/**
    Property (private): O.IO-key
    Type: Object

    Object reference held in a closure to ensure access to internal
    data structures is not leaked.
*/
var key = {};

var QUEUE = 1,
    IGNORE = 2,
    ABORT = 3;

var IO = NS.Class({
    
    Extends: NS.Object,
    
    /**
        Property (private): O.IO#_queue
        Type: Array
        
        Queue of request objects waiting for current transactions to finish.
    */
    
    /**
        Property (private): O.IO#_transportPool
        Type: Array
        
        Pool of idle XHR/other-transport-type objects.
    */
    
    /**
        Property: O.IO#_recent
        Type: (Object|null)
        
        A reference to the most recent active transport object
    */
    _recent: null,
    
    /**
        Property: O.IO#activeConnections
        Type: Number
        
        The number of active connections
    */
    activeConnections: 0,
    
    // Handling of multiple send() calls.
    
    /**
        Property: O.IO#link
        Type: Number
        Default: O.IO.QUEUE
        
        The property is used to determine what to do if a request is made and
        there are already the maximum allowed number of connections. Accepted
        values are the constants IO.QUEUE, IO.IGNORE and IO.ABORT. Queue: adds
        the request to a queue and then waits for the next active connection to
        finish before dispatching the oldest waiting request and so on until the
        queue is empty. Ignore: ignores the request if there are no free
        connections. Abort: aborts the most recent active request and
        immediately dispatches the new request.
    */
    link: QUEUE,
    
    /**
        Property: O.IO#maxConnections
        Type: Number
        Default: 1
        
        The maximum number of concurrent connections to make with this IO
        object. Note, this is a per-instance value; each IO instance may make up
        to maxConnections to the server as defined on that object.
    */
    maxConnections: 1,
    
    // General properties
    
    /**
        Property: O.IO#timeout
        Type: Number
        Default: 0
        
        Time in milliseconds to wait before timing out and aborting the request.
        If the value is 0, the request will not timeout but will wait
        indefinitely to complete.
    */
    timeout: 0,
    
    /**
        Property: O.IO#transport
        Type: O.Class
        Default: <O.XHR>
        
        The class (implementing the transport interface) to use for each
        connection.
    */
    transport: NS.XHR,
    
    /**
        Property: O.IO#method
        Type: String
        Default: 'GET'
        
        The default HTTP method to use (can be overridden individually in each
        request). Accepted values are 'GET' and 'POST'.
    */
    method: 'GET',
    
    /**
        Property: O.IO#url
        Type: String
        Default: The current location path (i.e. the URL before the ? or #).
        
        A default URL to send all requests to (can be overridden individually in
        each request)
    */
    url: document.location.pathname,
    
    /**
        Property: O.IO#contentType
        Type: String
        Default: 'application/x-www-form-urlencoded'

        The default type to send in the Content-type header for POST requests
        (can be overridden individually in each request).
    */
    contentType: 'application/x-www-form-urlencoded',
    
    /**
        Property: O.IO#headers
        Type: Object
        Default:
                {'X-Requested-With': 'XMLHttpRequest',
                 'Accept': 'text/javascript, text/html, application/json, * / *'
                }
        
        An object of default headers to be sent with each request (can be
        overriden individually in each request). The format of the object is
        `{headerName: headerValue}`.
    */
    
    /**
        Constructor: O.IO
        
        Parameters:
            config - {Object} An object containing new defaults for any of the
                     public properties defined on the object. Can also contain
                     methods to override the normal methods to create an
                     anonymous subclass.
    */
    init: function ( options ) {
        this._queue = [];
        this._transportPool = [];
        this.headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/javascript, text/html, application/json, */*'
        };
        IO.parent.init.call( this, options );
    },
    
    /**
        Method (private): O.IO#_onEvent
        
        Fires the onX method of the request object if present as well as the
        general io:X event on the IO object.
        
        Parameters:
            type    - {String} The type of event in lowercase, e.g. 'success'.
            request - {Object} request The request object supplied in the call
                      to send().
            details - {Object} (optional) An object of properties to be added to
                      the event object for the event.
    */
    _onEvent: function ( type, request, details ) {
        NS.RunLoop.begin();
        var onEvent = 'on' + type.capitalise();
        if ( request[ onEvent ] ) { request[ onEvent ]( details ); }
        ( details || ( details = {} ) ).request = request;
        this.fire( 'io:' + type, details );
        NS.RunLoop.end();
    },
    
    /**
        Event: io:begin
        
        This event is fired on the IO instance when a transaction is initiated.
     */
    
    /**
        Method: O.IO#send
     
        If the number of active requests is equal to the maximum allowed number
        of concurrent connections, the request will be queued, ignored or cause
        the most recent active request to abort as specified in the <O.IO#link>
        property. If the request was not ignored, a new connection is made to
        the URL specified in the request object, using the parameters in the
        request object or the default parameters for any not supplied.
        
        The request object may contain any of:
        
            {
               method: String,
               url: String,
               headers: Object,
               contentType: String
               data: String,
               onBegin: Function,
               onUploadProgress: Function,
               onLoading: Function,
               onSuccess: Function,
               onFailure: Function,
               onTimeout: Function,
               onAbort: Function,
               onEnd: Function
            }
        
        method, url, contentType and headers will override the default values
        set as properties of the same name on the IO instance. Note, if a
        headers object is supplied, only these headers will be set; it is not
        merged with the headers object on the IO instance. If data is not set,
        it will be null. Note contentType is only relevant for POST requests.
        
        The onX functions will be fired if/when the io:X event occurs for that
        particular request. See the documentation for these events to see when
        the event is fired and what parameters are on the event object.
     
        Parameters:
            request - {Object} (optional)
        
        Returns:
            {RequestToken} An opaque token used by the IO instance to identify
            the particular request.
    */
    send: function ( request ) {
        if ( !request ) { request = {}; }
        if ( this.get( 'activeConnections' ) >= this.get( 'maxConnections' ) ) {
            switch ( this.get( 'link' ) ) {
                case QUEUE:
                    this._queue.push( request );
                    return this;
                case IGNORE:
                    return this;
                case ABORT:
                    this.abort( this._recent );
                    break;
                default:
                    throw "Invalid O.IO link type.";
            }
        }
        
        this.increment( 'activeConnections', 1 );
        
        var transport = this._transportPool.length ?
                this._transportPool.pop() : new this.transport( this ),
            method = ( request.method || this.method ).toUpperCase(),
            url = request.url || this.url,
            data = request.data || '',
            headers = request.headers || this.headers;
        
        // Store reference in case we need to abort a request.
        this._recent = transport;
        
        if ( data && method === 'GET' ) {
            url += ( url.contains( '?' ) ? '&' : '?' ) + data;
            data = null;
        }
        if ( method === 'POST' ) {
            // All XMLHttpRequest data is sent as UTF-8 by the browser.
            // This cannot be altered.
            headers[ 'Content-type' ] =
                ( request.contentType || this.contentType ) + ';charset=utf-8';
        }
        if ( this.timeout ) {
            transport._io_timer = NS.RunLoop.invokeAfterDelay(
                transport._io_ontimeout = function () {
                    this._timeout( transport );
            }, this.timeout, this );
        }
        // Store reference to request object in transport
        // so we can fire any event handlers in it later.
        transport._io_request = request;
        
        // Send the request
        transport.send( method, url, data, headers );
        
        // Notify listeners
        this._onEvent( 'begin', request );
        
        // Closure allows access to transport object only by class methods.
        return function ( k ) { if ( k === key ) { return transport; } };
    },
    
    resetTimeout: function ( transport ) {
        if ( !transport ) { transport = this._recent; }
        var token = transport && transport._io_timer;
        if ( token ) {
            NS.RunLoop.cancel( token );
            transport._io_timer = NS.RunLoop.invokeAfterDelay(
                transport._io_ontimeout, this.timeout, this );
        }
    },
    
    /**
        Event: io:abort
        
        This event is fired on the IO instance when a transaction is aborted.
    */
    
    /**
        Method: O.IO#abort
        
        Aborts an in-progress transaction.
        
        Parameters:
            token - {RequestToken} (optional) The token returned by the send
                    method for this transaction. If not supplied, the most
                    recent request is aborted.
    */
    abort: function ( token, _silent ) {
        var transport = ( token instanceof Function ) ?
            token( key ) : token || this._recent;
        if ( transport ) {
            transport.abort();
            if ( !_silent ) { this._onEvent( 'abort', transport._io_request ); }
            this._complete( transport );
        }
        return this;
    },
    
    /**
        Event: io:uploadProgress
        
        This event *may* be fired by the IO instance as a FormData object is
        uploaded; but only if the browser supports XHR2.
    */
    
    /**
        Method: O.IO#uploadProgress
        
        This method is called by the transport object to report on the upload
        progress.
        
        Parameters:
            transport - {Transport} The transport object.
    */
    uploadProgress: function ( transport, event ) {
        this.resetTimeout( transport );
        this._onEvent( 'uploadProgress', transport._io_request, event );
    },
    
    /**
        Event: io:loading
        
        This event is fired on the IO instance when the response body begins to
        download.
    */
    
    /**
        Method: O.IO#loading
        
        This method is called by the transport object when loading of the
        response body has begun. In some browsers, this may be called multiple
        times as further data arrives.
        
        Parameters:
            transport - {Transport} The transport object.
    */
    loading: function ( transport ) {
        this.resetTimeout( transport );
        this._onEvent( 'loading', transport._io_request );
    },
    
    /**
        Event: io:progress
        
        This event may be fired on the IO instance periodically whilst the
        response body is downloading.
    */
    
    
    progress: function ( transport, event ) {
        this.resetTimeout( transport );
        this._onEvent( 'progress', transport._io_request, event );
    },
    
    /**
        Event: io:success

        This event is fired on the IO instance when the transaction is
        successful and all response data has been downloaded. It includes the
        following properties:
        
        type   - The MIME type of the response.
        status - The HTTP status code of the response.
        data   - The data returned by the response.
    */
    
    /**
        Method: O.IO#success
        
        This method is called by the transport object when the response body has
        completely downloaded successfully.
        
        Parameters:
            transport - {Transport} The transport object.
    */
    success: function ( transport ) {
        this._onEvent( 'success', transport._io_request, {
            status: transport.getStatus(),
            type: transport.getResponseType(),
            data: transport.getResponse()
        });
        this._complete( transport );
    },
    
    /**
        Event: io:failure

        This event is fired on the IO instance when a transaction completes
        unsuccessfully (normally determined by the HTTP status code). The status
        code is supplied as the status property of the event.
    */
    
    /**
        Method: O.IO#failure
        
        This method is called by the transport object when a transaction has
        completed unsuccessfully.
        
        Parameters:
            transport - {Transport} The transport object.
    */
    failure: function ( transport ) {
        this._onEvent( 'failure', transport._io_request, {
            status: transport.getStatus()
        });
        this._complete( transport );
    },
    
    /**
        Event: io:timeout
        
        This event is fired on the IO instance when a transaction times out.
    */
    
    /**
        Method (protected): O.IO#_timeout
        
        This method is called when a transaction times out. Unless overriden, it
        aborts the transaction.
        
        Parameters:
            transport - {Transport} The transport object.
    */
    _timeout: function ( transport ) {
        this._onEvent( 'timeout', transport._io_request );
        this.abort( transport, true );
    },
    
    /**
        Event: io:end
        
        This is the final event to be fired for a transaction and will always
        fire no matter if the event was successful, failed or aborted.
    */
    
    /**
        Method (private): O.IO#_complete
    
        Cleans up any state set by the IO methods on the Transport object and
        starts the next request in the queue, if any.
    
        Parameters:
            transport - {Transport} The transport object.
    */
    _complete: function ( transport ) {
        var request = transport._io_request;
        NS.RunLoop.cancel( transport._io_timer );
        transport._io_timer =
            transport._io_ontimeout =
            transport._io_request = null;
        if ( this._recent === transport ) {
            this._recent = null;
        }
        this._transportPool.push( transport );
        this.increment( 'activeConnections', -1 );
                
        if ( this._queue.length ) {
            this.send( this._queue.shift() );
        }
        
        this._onEvent( 'end', request );
    }
});

IO.QUEUE = 1;
IO.IGNORE = 2;
IO.ABORT = 3;

NS.IO = IO;

}( O ) );