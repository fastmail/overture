// -------------------------------------------------------------------------- \\
// File: Application.js                                                       \\
// Module: Application                                                        \\
// Requires: Core, Foundation, GlobalKeyboardShortcuts.js                     \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document, window */

"use strict";

/**
    Module: Application
    
    The Application module contains classes for managing an HTML5 application.
*/

( function ( NS ) {

var loc = window.location;
var getHash = function () {
    var href = loc.href,
        i = href.indexOf( '#' );
    return  i > -1 ? href.slice( i ) : '';
};

/**
    Class: O.Application
    
    Extends: O.Object
    
    The O.Application class manages the main window of the application. It saves
    and restores state to and from the URL and manages the main window title.
*/
var Application = NS.Class({
    
    Extends: NS.Object,
    
    // Window title management
    
    /**
        Property: O.Application#title
        Type: String
        
        The title to use for the main window.
    */
    title: '',
    /**
        Property: O.Application#defaultTitle
        Type: String
        Default: The <title> value in the page html.
        
        The title to use if <O.Application#title> is empty.
    */
    defaultTitle: document.title,
    
    /**
        Method: O.Application#setTitle
        
        Sets the window title. Called automatically whenever the
        <O.Application#title> property changes.
    */
    setTitle: function () {
        document.title = this.get( 'title' ) || this.get( 'defaultTitle' );
    }.observes( 'title', 'defaultTitle' ),
    
    // URL management
    
    /**
        Property: O.Application#isReady
        Type: Boolean
        
        Are the initial resources loaded yet? Set this to `true` when your
        application has loaded all its initial data. This will trigger the
        initial setting of state from the URL.
    */
    isReady: false,
    
    /**
        Property: O.Application#encodedState
        Type: String
        
        The encoded version of your application's current state. Whenever this
        changes, the URL will automatically be updated to match, therefore it
        should not contain any characters which are illegal in URLS. It may be a
        computed property with dependencies or set manually when state changes.
    */
    encodedState: '',
    
    /**
        Property: O.Application#routes
        Type: Array
        
        A collection of regular expressions for matching against URLs and
        functions for decoding the state from the match. Entries will be tried
        in order. Each entry should be an object with two properties:
        
        url    - {RegExp} The regular expression to execute on the encoded
                 state.
        handle - {Function} The handler for decoding the state if the regular
                 expression matches. This will be given the full encoded state
                 as the first parameter, followed by any capturing groups in the
                 regular expression.
    */
    routes: [],
    
    /**
        Property (private): O.Application#_currentHash
        Type: String
        
        The current hash in the URL.
    */
    _currentHash: getHash(),
    
    
    /**
        Constructor: O.Application
        
        Parameters:
            options - {Object} (optional) Any properties in this object will be
                      added to the new O.Application instance before
                      initialisation.
    */
    init: function () {
        var rootView = new NS.RootView( document );
        NS.extend( this, {
            views: new NS.Object({
               mainWindow: rootView
            }),
            controllers: new NS.Object(),
            keyboardShortcuts: NS.RootViewController.kbShortcuts =
                new NS.GlobalKeyboardShortcuts()
        });
        
        Application.parent.init.apply( this, arguments );
        
        window.addEventListener( 'hashchange', this, false );
        
        this.setTitle();
        this.restoreStateFromUrl();
    },
    
    handleEvent: function () {
        var hash = getHash();

        if ( hash !== this._currentHash ) {
            this._currentHash = hash;
            this.restoreStateFromUrl();
        }
    }.invokeInRunLoop(),
    
    /**
        Method: O.Application#restoreStateFromUrl
        
        Iterates throught the <O.Application#routes> until it finds a match,
        then uses that to decode the state from the URL. Called automatically
        whenever the URL changes.
    */
    restoreStateFromUrl: function () {
        if ( this.get( 'isReady' ) ) {
            var routes = this.get( 'routes' ),
                currentHash = this._currentHash,
                i, l, route, match;
            
            for ( i = 0, l = routes.length; i < l; i += 1 ) {
                route = routes[i];
                if ( match = route.url.exec( currentHash ) ) {
                    this.beginPropertyChanges();
                    route.handle.apply( this, match );
                    this.endPropertyChanges();
                    break;
                }
            }
        }
    }.observes( 'isReady' ),
    
    /**
        Method: O.Application#encodeStateToUrl
        
        Sets the current URL to match the <O.Application#encodedState> property.
        This method is called automatically once, at the end of the run loop
        (after bindings have synced), whenever this property changes.
    */
    encodeStateToUrl: function () {
        var hash = this.get( 'encodedState' );
        if ( this._currentHash !== hash ) {
            this._currentHash = hash;
            loc.hash = hash;
        }
    }.queue( 'after' ).observes( 'encodedState' )
});

// Expose Globals:

NS.Application = Application;

}( O ) );