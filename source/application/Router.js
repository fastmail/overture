/*global document, window, history, location */

import { Class } from '../core/Core';
import Obj from '../foundation/Object';
import '../foundation/ObservableProps';  // For Function#observes
import '../foundation/RunLoop';  // For Function#invokeInRunLoop, #queue

/**
    Module: Application

    The Application module contains classes for managing an HTML5 application.
*/

const getUrl = function ( location, base ) {
    location = location.toString();
    if ( !location.startsWith( base ) ) {
        const error = new Error( 'Router.baseUrl is bad: location doesn’t start with base' );
        error.details = { location, base };
        throw error;
    }
    return location.slice( base.length );
};

/**
    Class: O.Router

    Extends: O.Object

    This class adds the ability to manage the URL in the browser window,
    updating it when your application state changes and vice versa.
*/
const Router = Class({

    Extends: Obj,

    /**
        Property: O.Router#title
        Type: String

        The last title for the page window.
    */
    title: document.title,

    /**
        Property: O.Router#currentPath
        Type: String

        The last URL set by the app.
    */
    currentPath: '',

    /**
        Property: O.Router#baseUrl
        Type: String
        Default: the origin, plus a trailing slash.

        The path to the base of the URL space that maps to application state.
        There’s also a different default for the file: scheme, using the hash,
        but realise that it may have issues if you have links that use the hash,
        or if you try loading the page without “#/” added on the end.
    */
    baseUrl: location.protocol === 'file:' ?
        location.href.replace(/#.*/, '') + '#/' :
        location.protocol + '//' + location.host + '/',

    /**
        Property: O.Router#encodedState
        Type: String

        The encoded version of your application's current state. Whenever this
        changes, the URL will automatically be updated to match, therefore it
        should not contain any characters which are illegal in URLS. It may be a
        computed property with dependencies or set manually when state changes.
    */
    encodedState: '',

    /**
        Property: O.Router#replaceState
        Type: Boolean
        Default: false

        If set to true, the next change of encodedState will cause the current
        history entry to be relaced, rather than appending a new history entry.
        The property will then automatically be set back to false. Set this to
        true if you decode an invalid URL path to ensure it doesn't remain in
        the browser history.
    */
    replaceState: false,

    /**
        Property: O.Router#routes
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

    // eslint-disable-next-line object-shorthand
    init: function ( mixin, win ) {
        Router.parent.constructor.call( this, mixin );
        if ( !win ) {
            win = window;
        }
        this._routesChanged();
        win.addEventListener( 'popstate', this, false );
        this._win = win;
    },

    /**
        Method (private): O.Router#_setTitle

        Sets the window title. Called automatically whenever the
        <O.Router#title> property changes.
    */
    _setTitle: function () {
        document.title = this.get( 'title' );
    }.observes( 'title' ),

    /**
        Method: O.Router#handleEvent

        Called automatically whenever the URL changes. Will compare to the last
        set value and if different, invoke <O.Router#restoreStateFromUrl> with
        the new URL.
    */
    handleEvent: function () {
        const path = getUrl( this._win.location, this.baseUrl );

        if ( path !== this.get( 'currentPath' ) ) {
            this.set( 'currentPath', path );
            this.restoreStateFromUrl( path );
        }
    }.invokeInRunLoop(),

    /**
        Method: O.Router#restoreStateFromUrl

        Iterates throught the <O.Router#routes> until it finds a match, then
        uses that to decode the state from the URL. Called automatically
        whenever the URL changes.

        Parameters:
            url - {String} The url to restore state from.

        Returns:
            {O.Router} Returns self.
    */
    restoreStateFromUrl ( url ) {
        const routes = this.get( 'routes' );

        for ( let i = 0, l = routes.length; i < l; i += 1 ) {
            const route = routes[i];
            const match = route.url.exec( url );
            if ( match ) {
                this.beginPropertyChanges();
                route.handle.apply( this, match );
                this.endPropertyChanges();
                break;
            }
        }
        return this;
    },

    /**
        Method (private): O.Router#_routesChanged

        Reruns the routing, when the routes change. This is designed so that,
        for example, you can block routes when login is required.
    */
    _routesChanged: function () {
        const path = getUrl( win.location, this.baseUrl );
        this.set( 'currentPath', path );
        this.restoreStateFromUrl( path );
    }.observes( 'routes' ),

    /**
        Method (private): O.Router#_encodeStateToUrl

        Sets the current URL to match the <O.Router#encodedState> property.
        This method is called automatically once, at the end of the run loop,
        whenever this property changes.
    */
    _encodeStateToUrl: function () {
        const state = this.get( 'encodedState' );
        const replaceState = this.get( 'replaceState' );
        const win = this._win;
        if ( this.get( 'currentPath' ) !== state ) {
            this.set( 'currentPath', state );
            const history = win.history;
            const title = this.get( 'title' );
            const url = this.getUrlForEncodedState( state );
            if ( replaceState ) {
                history.replaceState( null, title, url );
                this.set( 'replaceState', false );
            } else {
                history.pushState( null, title, url );
            }
        }
    }.queue( 'after' ).observes( 'encodedState' ),

    getUrlForEncodedState ( state ) {
        return this.get( 'baseUrl' ) + state;
    },
});

export default Router;
