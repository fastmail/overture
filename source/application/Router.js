/*global location */

import { Class } from '../core/Core.js';
import Obj from '../foundation/Object.js';
import '../foundation/Decorators.js';

/**
    Module: Application

    The Application module contains classes for managing an HTML5 application.
*/

const hasOwnProperty = Object.prototype.hasOwnProperty;

let doRouting;

const globalQueryStringPart = function () {
    // We don’t actually *depend* on a stable order here, but it’s desirable.
    // The specs don’t quite guarantee us that, but all current browsers provide
    // it. See https://stackoverflow.com/q/30076219/30919039 for details.
    const { knownGlobalQueryParams } = this;
    let returnValue = '';
    for (const property in knownGlobalQueryParams) {
        if (hasOwnProperty.call(knownGlobalQueryParams, property)) {
            const value = this.get(property);
            if (value !== null) {
                if (returnValue) {
                    returnValue += '&';
                }
                returnValue +=
                    knownGlobalQueryParams[property] +
                    '=' +
                    encodeURIComponent(value);
            }
        }
    }
    return returnValue;
};

/**
    Class: O.Router

    Extends: O.Object

    This class adds the ability to manage the URL in the browser window,
    updating it when your application state changes and vice versa.

    One thing to be careful of: using the hash (you know, `<h2 id=foo>` with `<a
    href=#foo>` elsewhere) is unreliable; it will generally work, but navigation
    back/forwards won’t jump to the right place automatically like it would in a
    normal document. Also, modifying <O.Router#routes> will cause the route
    handler to be evaluated again, which, depending on how you do things, will
    probably clobber the hash.
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
        Property: O.Router#baseUrl
        Type: String
        Default: the origin, plus a trailing slash.

        The path to the base of the URL space that maps to application state.
        There’s also a different default for the file: scheme, using the hash,
        but realise that it may have issues if you have links that use the hash,
        or if you try loading the page without “#/” added on the end.

        This property must not be modified after router construction time.
    */
    baseUrl:
        location.protocol === 'file:'
            ? location.href.replace(/#.*/, '') + '#/'
            : location.protocol + '//' + location.host + '/',

    /**
        Property: O.Router#knownGlobalQueryParams
        Type: {[String]: String}
        Default: {}

        An object containing any query string parameters that are known to be
        global, and not part of router state; for example, a debug flag.

        This should be set at construction time (it’s read-only after that) to
        an object with one entry per global query string parameter.

        • The key will be used as the property name in this Router object (it is
          thereby observable), and MUST NOT contain "."; take care to avoid
          collisions with other properties on the router.
        • The value will be the name of the query string item, and MUST contain
          only URL-safe characters, and definitely no ampersands.

        (The distinction between key and value is made to avoid collisions
        between object or router properties and query string parameters;
        otherwise, an array would have been suitable.)

        Although this knownGlobalQueryParams property is read-only after
        construction, the properties it causes to exist may be modified,
        and the URL will be updated when that happens. But beware: any links
        generated will be not be updated unless they depend on
        globalQueryStringPart. (They also depend on baseUrl, but it’s not
        permitted to change after construction time.)

        Example:

            knownGlobalQueryParams: {
                debug: 'debug',
                titleParam: 'title',
            },

        This will cause the Router to have two observable properties `debug` and
        `titleParam`, which will have values like these:

            ======================================== =========== ===============
            URL                                      this.debug  this.titleParam
            ======================================== =========== ===============
            https://www.example.com/                 null        null
            https://www.example.com/?debug=1         "1"         null
            https://www.example.com/?debug=0&title=  "0"         ""
            https://www.example.com/?title=foo%3Dbar null        "foo=bar"
            ======================================== =========== ===============
    */
    knownGlobalQueryParams: {},

    /**
        Property: O.Router#globalQueryStringPart
        Type: String

        The current values of the global query parameters, encoded for inclusion
        in the query string by such methods as getUrlForEncodedState. This value
        will be of little direct value to you, but if you have links that must
        contain the current values of global query parameters, create a binding
        to this as in this example:

            el( 'a', {
                href: bind( router, 'globalQueryStringPart',
                    () => router.getUrlForEncodedState( 'foo' ) ),
            }, [
                'Foo',
            ]),

        If the URL needs to depend on other properties, I’m sure you can figure
        it out from here.

        This property is read-only to user code. To effect change in it, modify
        the underlying global parameter values directly instead.
    */
    // Constructor replaces this with a property with the correct dependencies.
    globalQueryStringPart: '',

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
        history entry to be replaced, rather than appending a new history entry.
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
                 minus any query string as the first parameter, the query string
                 decoded as an object for the second parameter, followed by any
                 capturing groups in the regular expression. Concerning the
                 query string object: if there is no query string, that second
                 parameter will be an empty object, not null. Also, global query
                 string parameters, which correspond to properties on the Router
                 instance, are excluded from the object.

        Handlers SHOULD be idempotent.
    */
    routes: [],

    init: function (mixin, win) {
        if (!win) {
            win = window;
        }

        // Before we can call the constructor, we need to sort out the magic of
        // global query parameters. We need to do this before calling super so
        // that globalQueryStringPart and the global query properties are all
        // initialised from the start, without causing unnecessary flap (which
        // can be particularly severe on _encodeStateToUrl, triggering it
        // prematurely, potentially before encodedState is correct).
        // Dodgy requirement: knownGlobalQueryParams may not be defined in some
        // Router subclass; it must be on Router, or mixin.
        const knownGlobalQueryParams =
            mixin.knownGlobalQueryParams ||
            Router.prototype.knownGlobalQueryParams;
        const globalQueryPropsByName = {};
        const globalQueryProps = Object.keys(knownGlobalQueryParams);
        const globalQueryNames = new Set(Object.values(knownGlobalQueryParams));

        const globalQueryMixin = {
            globalQueryStringPart: function () {
                return globalQueryStringPart.call(this);
            }.property(...globalQueryProps),

            _knownGlobalQueryParamNames: globalQueryNames,
        };

        // null them all to begin with,
        for (let i = globalQueryProps.length; i--; ) {
            const prop = globalQueryProps[i];
            globalQueryPropsByName[knownGlobalQueryParams[prop]] = prop;
            globalQueryMixin[prop] = null;
        }

        // then look through the query string, and set any global parameters.
        // Subtle point: for this initial global query string read, we use
        // location.search rather than the usual baseUrl-prefix remainder.
        // As with knownGlobalQueryParams, we can’t safely use `this.baseUrl`.
        // This has the side-effect that if you use the hash (for file:), global
        // query string parameters will be duplicated into the hash. We consider
        // this a feature, as the scenario won’t arise in production, and our
        // code loader discerns differences in what code should load using
        // location.search itself.
        const queryString = win.location.search;
        if (queryString) {
            queryString
                .slice(1)
                .split('&')
                .map((entry) => entry.split('=', 2).map(decodeURIComponent))
                .forEach(([name, value]) => {
                    if (globalQueryNames.has(name)) {
                        globalQueryMixin[globalQueryPropsByName[name]] = value;
                    }
                });
        }

        Router.parent.constructor.call(this, mixin, globalQueryMixin);

        this._win = win;
        this.doRouting();
        win.addEventListener('popstate', this, false);
    },

    /**
        Method (private): O.Router#_setTitle

        Sets the window title. Called automatically whenever the
        <O.Router#title> property changes.
    */
    _setTitle: function () {
        document.title = this.get('title');
    }.observes('title'),

    /**
        Method: O.Router#doRouting

        Reruns the routing. This method is called automatically when
        <O.Router#routes> changes. This is designed so that, for example, you
        can block routes when login is required.

        (This method would more naturally be called “route”, the verb, but that
        may lead to confusion with the noun “route”, referring to the current
        route. Hence the clumsy name doRouting.)
    */
    doRouting: (doRouting = function () {
        const baseUrl = this.baseUrl;
        const href = this._win.location.href;
        if (!href.startsWith(baseUrl)) {
            const error = new Error('Bad Router.baseUrl');
            error.details = { href, baseUrl };
            throw error;
        }
        this.restoreEncodedState(href.slice(baseUrl.length), null);
    }.observes('routes')),

    /**
        Method: O.Router#handleEvent

        Called automatically whenever the URL changes. Will compare to the last
        set value and if different, invoke <O.Router#restoreEncodedState> with
        the new URL.
    */
    handleEvent: doRouting.invokeInRunLoop(),

    /**
        Method: O.Router#restoreEncodedState

        Iterates throught the <O.Router#routes> until it finds a match, then
        uses that to decode the state. Called automatically whenever the URL
        changes, via <O.Router#doRouting>.

        The parameter queryParams is for the purpose of nested routers: routes
        on this router can take the path and parsed query parameters, and pass
        them on to a sub-router, which may just borrow this restoreEncodedState
        method.

        Parameters:
            encodedState - {String} The encodedState to restore state from, with
                           or without query string
            queryParams - {(Object|null)} (optional) The already-decoded query
                          string; passing a value for this requires that
                          encodedState not contain a query string

        Returns:
            {O.Router} Returns self.
    */
    restoreEncodedState(encodedState, queryParams) {
        this.beginPropertyChanges();

        if (!queryParams) {
            // We pass {} even if there is no query string; null would be
            // annoying for route handlers.
            queryParams = {};

            const queryStringStart = encodedState.indexOf('?');
            if (queryStringStart !== -1) {
                // Parse the query string
                const globalNames = this._knownGlobalQueryParamNames;
                // On checking globalNames: we casually support the notion of
                // sub-routers by borrowing the restoreEncodedState method from
                // Router; if that’s done, then globalNames will be undefined,
                // signifying “there are no global parameters”.
                encodedState
                    .slice(queryStringStart + 1)
                    .split('&')
                    .map((entry) => entry.split('=', 2).map(decodeURIComponent))
                    .forEach(([name, value]) => {
                        if (!globalNames || !globalNames.has(name)) {
                            // It’s a local parameter.
                            queryParams[name] = value;
                        }
                    });

                encodedState = encodedState.slice(0, queryStringStart);
            }
        }

        // Now finally on to the actual routing.
        const routes = this.get('routes');
        for (let i = 0, l = routes.length; i < l; i += 1) {
            const route = routes[i];
            const match = route.url.exec(encodedState);
            if (match) {
                // Example: encodedState is 'foo/bar?baz=quux',
                // route.url is /^foo\/(.*)$/, → route.handle.call( this,
                // 'foo/bar', { 'baz': 'quux' }, 'bar' )
                route.handle.call(
                    this,
                    encodedState,
                    queryParams,
                    ...match.slice(1),
                );
                break;
            }
        }

        this.endPropertyChanges();
        return this;
    },

    stripGlobalParams(encodedState) {
        const globalNames = this._knownGlobalQueryParamNames;
        const match = /^([^?#]*)(?:\?([^#]*))?(#.*)?$/.exec(encodedState);
        let queryString = match[2];
        // As written, this will also strip an empty query string. 👍
        if (queryString) {
            queryString = queryString
                .split('&')
                .filter(
                    (entry) =>
                        !globalNames.has(
                            decodeURIComponent(entry.split('=', 1)[0]),
                        ),
                )
                .join('&');
            if (queryString) {
                queryString = '?' + queryString;
            }
        }
        return match[1] + (queryString || '') + (match[3] || '');
    },

    /**
        Method (private): O.Router#_encodeStateToUrl

        Sets the current URL to match the <O.Router#encodedState> property.
        This method is called automatically once, at the end of the run loop,
        whenever this property changes.
    */
    _encodeStateToUrl: function () {
        const state = this.get('encodedState');
        const replaceState = this.get('replaceState');
        const win = this._win;
        const url = this.getUrlForEncodedState(state);
        const currentHref = win.location.href;
        if (
            currentHref === url ||
            (currentHref.startsWith(url) &&
                currentHref.charAt(url.length) === '#')
        ) {
            // At the same path (possibly with an added hash); nothing to do.
            return;
        }
        const history = win.history;
        const title = this.get('title');
        if (replaceState) {
            history.replaceState(null, title, url);
            this.set('replaceState', false);
        } else {
            history.pushState(null, title, url);
        }
    }
        .queue('after')
        .observes('encodedState', 'globalQueryStringPart'),

    // This method allows a hash to be in state, purely because in Fastmail we
    // have a few places where we want it so—we’re not quite dealing with
    // “encoded state” there, but rather partial URLs. Still, it’s kinda nice to
    // do it here. The rest of the router doesn’t really cope with a hash at
    // present. I’d like it to, but there are some interesting considerations,
    // like whether this.encodedState should include it, and whether it should
    // be part of routing (i.e. trigger the theoretically idempotent
    // restoreEncodedState on every hash change), and if so whether this means
    // yet another new argument to the handler or whether we stow it somewhere
    // else, or maybe we do the whole thing with events, and… and… yeah. I guess
    // I have another TODO. Lots of interesting things to consider.
    getUrlForEncodedState(state) {
        let url = this.baseUrl;
        const hashIndex = state.indexOf('#');
        let hash;
        if (hashIndex > -1) {
            hash = state.slice(hashIndex);
            url += state.slice(0, hashIndex);
        } else {
            url += state;
        }
        const globalQueryStringPart = this.get('globalQueryStringPart');
        if (globalQueryStringPart) {
            url += (state.includes('?') ? '&' : '?') + globalQueryStringPart;
        }
        if (hash) {
            url += hash;
        }
        return url;
    },
});

export default Router;
