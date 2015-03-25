// -------------------------------------------------------------------------- \\
// File: HttpRequest.js                                                       \\
// Module: IO                                                                 \\
// Requires: Core, Foundation, XHR.js                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global location */

"use strict";

( function ( NS ) {

var xhrPool = [];
var getXhr = function () {
    return xhrPool.pop() || new NS.XHR();
};
var releaseXhr = function ( xhr ) {
    xhrPool.push( xhr );
};

/**
    Class: O.HttpRequest

    Extends: O.Object

    The O.HttpRequest class represents an HTTP request. It will automatically
    choose between an XHR and an iframe form submission for uploading form data,
    depending on browser support.
*/

var HttpRequest = NS.Class({

    Extends: NS.Object,

    /**
        Property: O.HttpRequest#timeout
        Type: Number
        Default: 0

        Time in milliseconds to wait before timing out and aborting the request.
        If the value is 0, the request will not timeout but will wait
        indefinitely to complete.
    */
    timeout: 0,

    /**
        Property: O.HttpRequest#method
        Type: String
        Default: 'GET'

        The HTTP method to use for the request.
    */
    method: 'GET',

    /**
        Property: O.HttpRequest#url
        Type: String
        Default: The current location path (i.e. the URL before the ? or #).

        The URL to submit the request to.
    */
    url: location.pathname,

    /**
        Property: O.HttpRequest#contentType
        Type: String
        Default: 'application/x-www-form-urlencoded'

        The Content-type header for POST requests.
    */
    contentType: 'application/x-www-form-urlencoded',

    /**
        Property: O.HttpRequest#headers
        Type: Object
        Default:
                {Accept: 'application/json, * / *'}

        An object of default headers to be sent with each request (can be
        overriden individually in each request). The format of the object is
        `{headerName: headerValue}`.
    */
    headers: {
        'Accept': 'application/json, */*'
    },

    // ---

    init: function ( mixin ) {
        this._transport = null;
        this._timer = null;
        this._lastActivity = 0;

        this.uploadProgress = 0;
        this.progress = 0;

        this.status = 0;
        this.responseType = '';
        this.responseHeaders = {};
        this.response = '';

        HttpRequest.parent.init.call( this, mixin );
    },

    // ---

    setTimeout: function () {
        var timeout = this.get( 'timeout' );
        if ( timeout ) {
            this._lastActivity = Date.now();
            this._timer = NS.RunLoop.invokeAfterDelay(
                this.didTimeout, timeout, this );
        }
    }.on( 'io:begin' ),

    resetTimeout: function () {
        this._lastActivity = Date.now();
    }.on( 'io:uploadProgress', 'io:loading', 'io:progress' ),

    clearTimeout: function () {
        var timer = this._timer;
        if ( timer ) {
            NS.RunLoop.cancel( timer );
        }
    }.on( 'io:end' ),

    didTimeout: function () {
        this._timer = null;
        var timeout = this.get( 'timeout' ),
            timeSinceLastReset = Date.now() - this._lastActivity,
            timeToTimeout = timeout - timeSinceLastReset;
        // Allow for 10ms jitter
        if ( timeToTimeout < 10 ) {
            this.fire( 'io:timeout' );
            this.abort();
        } else {
            this._timer = NS.RunLoop.invokeAfterDelay(
                this.didTimeout, timeToTimeout, this );
        }
    },

    // ---

    send: function () {
        var method = this.get( 'method' ).toUpperCase(),
            url = this.get( 'url' ),
            data = this.get( 'data' ) || null,
            headers = this.get( 'headers' ),
            transport =
                ( data instanceof FormData && NS.FormUploader !== NS.XHR ) ?
                    new NS.FormUploader() : getXhr();

        if ( data && method === 'GET' ) {
            url += ( url.contains( '?' ) ? '&' : '?' ) + data;
            data = null;
        }
        if ( method === 'POST' && !headers[ 'Content-type' ] ) {
            // All XMLHttpRequest data is sent as UTF-8 by the browser.
            // This cannot be altered.
            headers = NS.clone( headers );
            headers[ 'Content-type' ] =
                this.get( 'contentType' ) + ';charset=utf-8';
        }

        // Send the request
        this._transport = transport;
        transport.io = this;
        transport.send( method, url, data, headers );

        return this;
    },

    abort: function () {
        var transport = this._transport;
        if ( transport && transport.io === this ) {
            transport.abort();
        }
    },

    _releaseXhr: function () {
        var transport = this._transport;
        if ( transport instanceof NS.XHR ) {
            releaseXhr( transport );
            transport.io = null;
            this._transport = null;
        }
    }.on( 'io:success', 'io:failure', 'io:abort' )

    // ---

    /**
        Event: io:begin

        This event is fired when the request starts.
     */

    /**
        Event: io:abort

        This event is fired if the request is aborted.
    */

    /**
        Event: io:uploadProgress

        This event *may* be fired as data is uploaded, but only if the browser
        supports XHR2.
    */

    /**
        Event: io:loading

        This event is fired when the response body begins to download.
    */

    /**
        Event: io:progress

        This event *may* be fired periodically whilst the response body is
        downloading, but only if the browser supports XHR2.
    */

    /**
        Event: io:success

        This event is fired if the request completes successfully. It includes
        the following properties:

        status  - The HTTP status code of the response.
        headers - The headers of the response.
        type    - The MIME type of the response.
        data    - The data returned by the response.
    */

    /**
        Event: io:failure

        This event is fired if the request completes unsuccessfully (normally
        determined by the HTTP status code). It includes the following
        properties:

        status  - The HTTP status code of the response.
        headers - The headers of the response.
        type    - The MIME type of the response.
        data    - The data returned by the response.
    */

    /**
        Event: io:timeout

        This event is fired if the request times out.
    */

    /**
        Event: io:end

        This is the final event to be fired for the request, this will always
        fire no matter if the request was successful, failed or aborted.
    */
});

NS.HttpRequest = HttpRequest;

}( O ) );
