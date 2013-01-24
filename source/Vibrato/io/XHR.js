// -------------------------------------------------------------------------- \\
// File: XHR.js                                                               \\
// Module: IO                                                                 \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global XMLHttpRequest, FormData, location */

"use strict";

( function ( NS ) {

var isLocal = location.protocol === 'file:';

/**
    Class: O.XHR

    Wrapper class for the native XMLHTTPRequest object in the browser. Hooks
    into the more fully featured I/O class but can be used on its own
*/
var XHR = NS.Class({
    /**
        Property (private): O.XHR#_io
        Type: Object

        Reference to object on which callbacks are made.
    */
    _io: {
        // uploadProgress: function () {},
        // loading: function () {},
        // success: function () {},
        // failure: function () {}
    },

    /**
        Property (private): O.XHR#_isRunning
        Type: Boolean

        Is a request in progress?
    */
    _isRunning: false,

    /**
        Constructor: O.XHR

        Parameters:
            io - {Object} (optional) An object containing any combination of the
                 methods 'uploadProgress', 'loading', 'success' and 'failure',
                 to be called by the XHR instance as these events occur.
    */
    init: function ( io ) {
        if ( io ) { this._io = io; }
        var xhr = this.xhr = new XMLHttpRequest(),
            that = this;
        if ( xhr.upload && io && io.uploadProgress ) {
            xhr.upload.addEventListener( 'progress', function ( event ) {
                io.uploadProgress( that, event );
            }.invokeInRunLoop(), false );
        }
        if ( xhr.addEventListener && io && io.progress ) {
            xhr.addEventListener( 'progress', function ( event ) {
                io.progress( that, event );
            }.invokeInRunLoop(), false );
        }
    },

    /**
        Method: O.XHR#isSuccess

        Determines whether a request completed successfully, as determined by
        the HTTP status code returned.

        Returns:
            {Boolean} Was the request successful?
    */
    isSuccess: function () {
        var status = this._status;
        // IE returns 200 status code when there's no network! But for a real
        // connection there must have been at least one header, so check that's
        // not empty
        return ( status >= 200 && status < 300 ) &&
            !!this.xhr.getAllResponseHeaders();
    },

    /**
        Method: O.XHR#isRunning

        Determines whether a request is currently in progress.

        Returns:
            {Boolean} Is there a request still in progress?
    */
    isRunning: function () {
        return !!this._isRunning;
    },

    /**
        Method: O.XHR#getHeader

        Returns the contents of the response header corresponding to the name
        supplied as a parameter to the method.

        Parameters:
            name - {String} The name of the header to be fetched.

        Returns:
            {String} The text of the header or the empty string if not found.
    */
    getHeader: function ( name ) {
        var header;
        try {
            header = this.xhr.getResponseHeader( name );
        } catch ( error ) {}
        return header || '';
    },

    /**
        Method: O.XHR#getResponse

        Returns the full text of the response to the request.

        Returns:
            {String} The response text.
    */
    getResponse: function () {
        // Internet Explorer may throw an error if you try to read the
        // responseText before it is in readyState 4.
        var response = '';
        try {
            response = this.xhr.responseText;
        } catch ( error ) {}
        return response || '';
    },

    /**
        Method: O.XHR#getResponseType

        Returns the MIME type of the response, according to the Content-type
        header set by the server.

        Returns:
            {String} The MIME type of the response.
    */
    getResponseType: function () {
        return this.getHeader( 'Content-type' );
    },

    /**
        Method: O.XHR#getStatus

        Returns the HTTP status code returned by the server in response to the
        request.

        Returns:
            {Number} The HTTP status code
    */
    getStatus: function () {
        return this._status;
    },

    /**
        Method: O.XHR#send

        If a request is currently active, it is first aborted. A new request is
        then made to the server, using the parameters supplied.

        Parameters:
            method  - {String} The HTTP method to use ('GET' or 'POST').
            url     - {String} The URL to which the request is to be made. This
                      must be at the same domain as the current page or a
                      security error will be thrown.
            data    - {String} The data to send in the body of the request; only
                      valid for POST requests; this will be ignored if the
                      method is GET.
            headers - {Object} (Optional) A set of key:value pairs corresponding
                      to header names and their values which will be sent with
                      the request.

        Returns:
            {O.XHR} Returns self.
    */
    send: function ( method, url, data, headers ) {
        if ( this._isRunning ) {
            this.abort();
        }
        this._isRunning = true;

        var xhr = this.xhr,
            that = this;

        // Let the browser set this automatically, otherwise it might be missing
        // the boundary marker.
        if ( data instanceof FormData ) {
            delete headers[ 'Content-type' ];
        }

        xhr.open( method, url, true );
        for ( var name in headers || {} ) {
            if ( headers.hasOwnProperty( name ) ) {
                xhr.setRequestHeader( name, headers[ name ] );
            }
        }
        xhr.onreadystatechange = function () {
            that._xhrStateDidChange( this );
        };
        xhr.send( data );

        return this;
    },

    /**
        Method (private): O.XHR#_xhrStateDidChange

        Determines the state of the XMLHttpRequest object and fires the
        appropriate callbacks when it is loading/finished.

        Parameters:
            xhr - {XMLHttpRequest} The object whose state has changed.
    */
    _xhrStateDidChange: function ( xhr ) {
        var state = xhr.readyState,
            io = this._io;
        if ( state < 3 || !this._isRunning ) { return; }

        if ( state === 3 ) {
            if ( io.loading ) { io.loading( this ); }
            return;
        }

        this._isRunning = false;
        xhr.onreadystatechange = function () {};

        var status = xhr.status;
        this._status =
            // IE8 translates response code 204 to 1223
            ( status === 1223 ) ? 204 :
            // Local requests will have a 0 response
            ( !status && isLocal ) ? 200 :
            status;

        if ( this.isSuccess() ) {
            if ( io.success ) { io.success( this ); }
        }
        else {
            if ( io.failure ) { io.failure( this ); }
        }
    }.invokeInRunLoop(),

    /**
        Method: O.XHR#abort

        Aborts the currently active request. No further callbacks will be made
        for that request. If there is no active request, calling this method has
        no effect.

        Returns:
            {O.XHR} Returns self.
    */
    abort: function () {
        if ( this._isRunning ) {
            this._isRunning = false;
            var xhr = this.xhr;
            xhr.abort();
            xhr.onreadystatechange = function () {};
        }
        return this;
    }
});

NS.XHR = XHR;

}( this.O ) );
