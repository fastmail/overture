/*global XMLHttpRequest, FormData, location */

import '../foundation/RunLoop';  // For Function#invokeInRunLoop

const parseHeaders = function ( allHeaders ) {
    const headers = {};
    let start = 0;
    while ( true ) {
        // Ignore any leading white space
        while ( /\s/.test( allHeaders.charAt( start ) ) ) {
            start += 1;
        }
        // Look for ":"
        let end = allHeaders.indexOf( ':', start );
        if ( end < 0 ) {
            break;
        }
        // Slice out the header name.
        // Convert to lower-case: HTTP2 will always be lower case, but HTTP1
        // may be mixed case, which causes bugs!
        const name = allHeaders.slice( start, end ).toLowerCase();
        // Trim off any spaces after the colon.
        start = end + 1;
        while ( allHeaders.charAt( start ) === ' ' ) {
            start += 1;
        }
        // And find the end of the header
        end = allHeaders.indexOf( '\n', start );
        if ( end < 0 ) {
            end = allHeaders.length;
        }
        // Trim any trailing white space
        while ( end > start && /\s/.test( allHeaders.charAt( end - 1 ) ) ) {
            end -= 1;
        }
        // Add to the headers object
        headers[ name ] = allHeaders.slice( start, end );
        // And start looking for the next header
        start = end + 1;
    }
    return headers;
};

/**
    Class: O.XHR

    Wrapper class for the native XMLHTTPRequest object in the browser. Hooks
    into the more fully featured <O.HttpRequest> class; you should use that
    class for most things.
*/
class XHR {
    /**
        Constructor: O.XHR

        Parameters:
            io - {O.Object} (optional).
    */
    constructor ( io ) {
        this._isRunning = false;
        this._status = 0;
        this.io = io || null;
        this.xhr = null;
    }
}

Object.assign( XHR.prototype, {
    /**
        Property: O.XHR#io
        Type: (O.Object|null)

        Reference to object on which properties are set and events fired.
    */

    /**
        Property (private): O.XHR#_isRunning
        Type: Boolean

        Is a request in progress?
    */

    /**
        Property: O.XHR#makeAsyncRequests
        Type: Boolean
        Default: true

        If changed to false, the connections will be synchronous rather than
        async. This should *only* ever be set during the onunload event,
        where you need to make a request synchronous to ensure it completes
        before the tab process is killed.
    */
    makeAsyncRequests: true,

    destroy () {
        this.abort();
    },

    /**
        Method: O.XHR#isRunning

        Determines whether a request is currently in progress.

        Returns:
            {Boolean} Is there a request still in progress?
    */
    isRunning () {
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
    getHeader ( name ) {
        try {
            return this.xhr.getResponseHeader( name ) || '';
        } catch ( error ) {
            return '';
        }
    },

    /**
        Method: O.XHR#getResponse

        Returns the response to the request.

        Returns:
            {String|ArrayBuffer|Blob|Document|Object|null} The response.
            (The type is determined by the responseType parameter to #send.)
    */
    getResponse () {
        try {
            return this.xhr.response;
        } catch ( error ) {
            return null;
        }
    },

    /**
        Method: O.XHR#getStatus

        Returns the HTTP status code returned by the server in response to the
        request.

        Returns:
            {Number} The HTTP status code
    */
    getStatus () {
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
            withCredentials - {Boolean} (Optional) (Default false) Whether or
                              not to include credentials in cross-site requests
            responseType - {String} See XMLHttpRequest.responseType for
                           permitted values. This controls the type of
                           {O.XHR#getResponse} and in consequence the {data}
                           field on an {io:success} or {io:failure} event.

        Returns:
            {O.XHR} Returns self.
    */
    send ( method, url, data, headers, withCredentials, responseType ) {
        if ( this._isRunning ) {
            this.abort();
        }
        this._isRunning = true;

        const xhr = this.xhr = new XMLHttpRequest();
        const io = this.io;
        const that = this;

        if ( io ) {
            io.fire( 'io:begin' );
        }

        xhr.open( method, url, this.makeAsyncRequests );
        xhr.withCredentials = !!withCredentials;
        responseType = responseType || '';
        xhr.responseType = responseType;
        // If a browser doesn’t support a particular value (IE 11 with 'json'),
        // xhr.responseType becomes an empty string, and we will need to
        // simulate it ourselves later. (We don’t support IE≤9 which don’t do
        // responseType at all. We assume all the other values will work fine.)
        this._actualResponseType = xhr.responseType !== responseType ?
            responseType : '';
        for ( const name in headers || {} ) {
            // Let the browser set the Content-type automatically if submitting
            // FormData, otherwise it might be missing the boundary marker.
            if ( name !== 'Content-type' || !( data instanceof FormData ) ) {
                xhr.setRequestHeader( name, headers[ name ] );
            }
        }
        xhr.onreadystatechange = function () {
            that._xhrStateDidChange( this );
        };

        if ( xhr.upload ) {
            // FF will force a preflight on simple cross-origin requests if
            // there is an upload handler set. This follows the spec, but the
            // spec is clearly wrong here and Blink/Webkit do not follow it.
            // See https://bugzilla.mozilla.org/show_bug.cgi?id=727412
            // Workaround by not bothering registering an upload progress
            // handler for GET requests, as it's not needed in this case anyway.
            if ( method !== 'GET' ) {
                xhr.upload.addEventListener( 'progress', this, false );
            }
            xhr.addEventListener( 'progress', this, false );
        }

        try {
            xhr.send( data );
        } catch ( error ) {
            // Some browsers can throw a NetworkError under certain conditions
            // for example if this is a synchronous request and there's no
            // network. Treat as an abort.
            this.abort();
        }

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
        const state = xhr.readyState;
        const io = this.io;

        if ( state < 3 || !this._isRunning ) {
            return;
        }

        if ( state === 3 ) {
            if ( io ) {
                io.set( 'uploadProgress', 100 )
                  .fire( 'io:loading' );
            }
            return;
        }

        this._isRunning = false;
        xhr.onreadystatechange = function () {};
        if ( xhr.upload ) {
            xhr.upload.removeEventListener( 'progress', this, false );
            xhr.removeEventListener( 'progress', this, false );
        }

        const status = xhr.status;
        this._status = status;

        if ( io ) {
            const allHeaders = xhr.getAllResponseHeaders();
            const responseHeaders = parseHeaders( allHeaders );
            let response = this.getResponse();
            if ( this._actualResponseType === 'json' ) {
                try {
                    response = JSON.parse( response );
                } catch ( error ) {
                    response = null;
                }
            }
            // IE returns 200 status code when there's no network! But for a
            // real connection there must have been at least one header, so
            // check that's not empty. Except for cross-domain requests no
            // headers may be returned, so also check for a body
            const isSuccess = ( status >= 200 && status < 300 ) &&
                ( !!allHeaders || !!response );
            io.set( 'uploadProgress', 100 )
              .set( 'progress', 100 )
              .set( 'status', status )
              .set( 'responseHeaders', responseHeaders )
              .set( 'response', response )
              .fire( isSuccess ? 'io:success' : 'io:failure', {
                status,
                headers: responseHeaders,
                data: response,
              })
              .fire( 'io:end' );
        }
    }.invokeInRunLoop(),

    handleEvent: function ( event ) {
        const io = this.io;
        if ( io && event.type === 'progress' ) {
            const type = event.target === this.xhr ? 'progress' :
                                                     'uploadProgress';
            // CORE-47058. Limit to 99% on progress events, as Opera can report
            // event.loaded > event.total! Will be set to 100 in onSuccess
            // handler.
            io.set( type, Math.min( 99,
                    ~~( ( event.loaded / event.total ) * 100 ) ) )
              .fire( 'io:' + type, event );
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
    abort () {
        if ( this._isRunning ) {
            this._isRunning = false;
            const xhr = this.xhr;
            const io = this.io;
            xhr.abort();
            xhr.onreadystatechange = function () {};
            if ( xhr.upload ) {
                xhr.upload.removeEventListener( 'progress', this, false );
                xhr.removeEventListener( 'progress', this, false );
            }
            if ( io ) {
                io.fire( 'io:abort' )
                  .fire( 'io:end' );
            }
        }
        return this;
    },
});

export default XHR;
