// -------------------------------------------------------------------------- \\
// File: FormUploader.js                                                      \\
// Module: IO                                                                 \\
// Requires: Core, Foundation, XHR.js                                         \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global window, document */

"use strict";

( function ( NS ) {

var hidden = {
    position: 'absolute',
    top: -1000,
    left: -1000
};

/**
    Class: O.FormUploader

    A class suitable for uploading FormData objects. The concrete class may be
    <O.XHR> if it supports the XMLHttpRequest Level 2 spec, or
    <O.FormUploader-IFrameTransport> if not. Either way, the interface is
    identical so you can ignore the underlying implementation.
*/
/**
    Constructor: O.FormUploader

    Parameters:
        io - {Object} An object containing any combination of the methods
             'uploadProgress', 'loading', 'success' and 'failure', to be called
             by the FormUploader instance as these events occur.
*/

/**
    Class: O.FormUploader-IFrameTransport

    An IO-compatible class that submits form data to a hidden iframe, allowing
    background file uploading.
*/
NS.FormUploader = window.FormData ? NS.XHR : NS.Class({
    /**
        Property (private): O.FormUploader-IFrameTransport#_io
        Type: Object

        Reference to object on which callbacks are made.
    */
    _io: {},

    /**
        Constructor: O.FormUploader-IFrameTransport

        Parameters:
            io - {Object} An object containing any combination of the methods
                 'uploadProgress', 'loading', 'success' and 'failure', to be
                 called by the FormUploader instance as these events occur.
    */
    init: function ( io ) {
        this._io = io;
    },

    /**
        Property (private): O.FormUploader-IFrameTransport#_isSuccess
        Type: Boolean

        Was the request successful?
    */
    _isSuccess: false,

    /**
        Method: O.FormUploader-IFrameTransport#isSuccess
            Determines whether a request completed successfully.

        Returns:
            {Boolean} Was it successful?
    */
    isSuccess: function () {
        return this._isSuccess;
    },

    /**
        Property (private): O.FormUploader-IFrameTransport#_isRunning
        Type: Boolean

        Is there a request in progress?
    */
    _isRunning: false,

    /**
        Method: O.FormUploader-IFrameTransport#isRunning

        Determines whether a request is currently in progress.

        Returns:
            {Boolean} Is there a request in progress?
    */
    isRunning: function () {
        return this._isRunning;
    },

    /**
        Property (private): O.FormUploader-IFrameTransport#_response
        Type: String

        The response text.
    */
    _response: '',

    /**
        Method: O.FormUploader-IFrameTransport#getResponse
            Get the response to the request.

        Returns:
            {String} The full text of the response to the request.
    */
    getResponse: function () {
        return this._response;
    },

    /**
        Method: O.FormUploader-IFrameTransport#getResponseType

        Returns:
            {String} Always "application/json".
    */
    getResponseType: function () {
        return 'application/json';
    },

    /**
        Method: O.FormUploader-IFrameTransport#getStatus

        Returns the HTTP status code representing the status of the request.

        Returns:
            {Number} The HTTP status code.
    */
    getStatus: function () {
        return this._isRunning ? 0 : this._isSuccess ? 200 : 400;
    },

    /**
        Method: O.FormUploader-IFrameTransport#send

        If a request is currently active, it is first aborted. A new request is
        then made to the server, using the parameters supplied.

        Parameters:
            method - {String} This is ignored; the method is always POST.
            url    - {String} The URL to which the request is to be made.
            data   - {FormData} The data to send in the body of the request.

        Returns:
            {O.FormUploader-IFrameTransport} Returns self.
    */
    send: function ( method, url, data ) {
        if ( !( data instanceof window.FormData ) ) {
            throw new Error( 'IFrameTransport only sends FormData objects' );
        }
        if ( this._isRunning ) {
            this.abort();
        }

        this._isRunning = true;
        this._isSuccess = false;
        this._response = '';

        var that = this,
            body = document.body,
            transactionId = this._transactionId = 'upload' + Date.now(),
            frameName = 'frame-' + transactionId,
            iframe = this._iframe = NS.Element.create( 'iframe', {
                id: frameName,
                name: frameName,
                styles: hidden
            }),
            form = this._form = data.form;

        url += ( url.contains( '?' ) ? '&' : '?' ) +
            'callback=top.' + transactionId;
        form.action = this._targetUrl = url;
        form.target = frameName;

        iframe.addEventListener( 'load', this._loadfn = function () {
            that._formFrameDidLoad();
        }, false );

        window[ transactionId ] = function ( data ) {
            that._response = JSON.stringify( data );
            that._isSuccess = true;
            that._io.success( that );
        };

        body.appendChild( iframe );
        body.appendChild( form );
        form.submit();

        return this;
    },

    /**
        Method (private): O.FormUploader-IFrameTransport#_formFrameDidLoad

        Callback for when the iframe to which the form was submitted has loaded.
    */
    _formFrameDidLoad: function () {
        // First load event is fired as soon as the frame is appended to the
        // DOM. Ignore this one; we're only interested in what happens after the
        // full page has loaded.
        if ( this._iframe.contentWindow.location.href === 'about:blank' ) {
            return;
        }
        this._isRunning = false;
        if ( !this._isSuccess ) {
            this._io.failure( this );
        }
        this._complete();
    },

    /**
        Method: O.FormUploader-IFrameTransport#abort

        Aborts the currently active request. No further callbacks will be made
        for that request. If there is no active request, calling this method has
        no effect.

        Returns:
            {O.FormUploader-IFrameTransport} Returns self.
    */
    abort: function () {
        if ( this._isRunning ) {
            this._isRunning = false;
            this._complete();
        }
        return this;
    },

    /**
        Method (private): O.FormUploader-IFrameTransport#_complete

        Removes event listeners and releases references to objects associated
        with the request.
    */
    _complete: function () {
        var body = document.body;
        body.removeChild( this._form );
        body.removeChild( this._iframe );
        this._iframe.removeEventListener( 'load', this._loadfn, false );
        delete window[ this._transactionId ];
        this._iframe = this._form = this._loadfn = null;
    }
});

/**
    Class: FormData

    Implementation of the FormData object for browsers that don't natively
    support it. Slightly different from spec in that you can call append() with
    a form element as the value; this is to support browsers that do not
    implement the File API and therefore cannot supply a File object as the
    value.
*/
if ( !window.FormData ) {
    window.FormData = NS.Class({
        init: function () {
            this.form = NS.Element.create( 'form', {
                method: 'post',
                enctype: 'multipart/form-data',
                styles: hidden
            });
        },
        append: function ( name, value ) {
            if ( typeof value === 'string' ) {
                this.form.appendChild( NS.Element.create( 'input', {
                    type: 'hidden',
                    name: name,
                    value: value
                }) );
            } else {
                var file = value.file;
                if ( file.nodeType ) {
                    file.name = name;
                    this.form.appendChild( file );
                }
            }
        }
    });
    window.FormData.isFake = true;
}

}( this.O ) );
