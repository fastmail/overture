/*global document, window, history, location */

import { Class } from '../core/Core';
import Obj from '../foundation/Object';
import '../foundation/ObservableProps';  // For Function#observes
import '../foundation/RunLoop';  // For Function#invokeInRunLoop, #queue

/**
    Module: Application

    The Application module contains classes for managing an HTML5 application.
*/

const getHash = function ( location ) {
    const href = location.href;
    const i = href.indexOf( '#/' );
    return  i > -1 ? href.slice( i + 2 ) : '';
};
const getUrl = function ( location, base ) {
    return location.pathname.slice( base.length );
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
        Property: O.Router#useHash
        Type: Boolean
        Default: True if supported

        If true, will use pushState to manipulate the real URL. If false, will
        just set the hash component instead. By default this is true if the
        browser supports pushState and false otherwise. If left as true,
        <O.Router#baseUrl> *must* be correctly configured.
    */
    useHash: !history.pushState || ( location.protocol === 'file:' ),

    /**
        Property: O.Router#baseUrl
        Type: String
        Default: "/"

        The path to the base of the URL space that maps to application state.
    */
    baseUrl: '/',

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
        Property: O.Router#mayGoBack
        Type: Boolean
        Default: true

        If false, the router will ignore history events (hashchange or
        popstate).
    */
    mayGoBack: true,

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

    init ( mixin, win ) {
        Router.parent.constructor.call( this, mixin );
        if ( !win ) {
            win = window;
        }
        const location = win.location;
        const path = ( this.useHash && getHash( location ) ) ||
                getUrl( location, this.baseUrl );
        this.set( 'currentPath', path );
        this.restoreStateFromUrl( path );
        win.addEventListener(
            this.useHash ? 'hashchange' : 'popstate', this, false );
        this._win = win;
    },

    /**
        Method: O.Router#setTitle

        Sets the window title. Called automatically whenever the
        <O.Router#title> property changes.
    */
    setTitle: function () {
        document.title = this.get( 'title' );
    }.observes( 'title' ),

    /**
        Method: O.Router#handleEvent

        Called automatically whenever the URL changes. Will compare to the last
        set value and if different, invoke <O.Router#restoreStateFromUrl> with
        the new URL.
    */
    handleEvent: function () {
        const location = this._win.location;
        const path = this.useHash ?
                getHash( location ) : getUrl( location, this.baseUrl );

        if ( this.get( 'mayGoBack' ) && path !== this.get( 'currentPath' ) ) {
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
        Method: O.Router#encodeStateToUrl

        Sets the current URL to match the <O.Router#encodedState> property.
        This method is called automatically once, at the end of the run loop,
        whenever this property changes.
    */
    encodeStateToUrl: function () {
        const state = this.get( 'encodedState' );
        const replaceState = this.get( 'replaceState' );
        const win = this._win;
        if ( this.get( 'currentPath' ) !== state ) {
            this.set( 'currentPath', state );
            if ( this.useHash ) {
                const location = win.location;
                if ( replaceState ) {
                    let href = location.href;
                    const i = href.indexOf( '#' );
                    if ( i > -1 ) {
                        href = href.slice( 0, i );
                    }
                    location.replace( href + '#/' + state );
                } else {
                    location.hash = '#/' + state;
                }
            } else {
                const history = win.history;
                const title = this.get( 'title' );
                const url = this.getUrlForEncodedState( state );
                // Firefox sometimes throws an error for no good reason,
                // especially on replaceState, so wrap in a try/catch.
                try {
                    if ( replaceState ) {
                        history.replaceState( null, title, url );
                    } else {
                        history.pushState( null, title, url );
                    }
                } catch ( error ) {}
            }
            if ( replaceState ) {
                this.set( 'replaceState', false );
            }
        }
    }.queue( 'after' ).observes( 'encodedState' ),

    getUrlForEncodedState ( state ) {
        return this.get( 'baseUrl' ) + state;
    },
});

export default Router;
