// -------------------------------------------------------------------------- \\
// File: UA.js                                                                \\
// Module: UA                                                                 \\
// Requires: Core, Foundation                                                 \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*global navigator, document, window */

"use strict";

/**
    Module: UA

    The UA module contains information about the platform on which the
    application is running.
*/
( function ( NS ) {

var ua = navigator.userAgent.toLowerCase(),
    other = [ 'other', '0' ],
    platform = /ip(?:ad|hone|od)/.test( ua ) ? 'ios' : (
        /android|webos/.exec( ua ) ||
        /mac|win|linux/.exec( navigator.platform.toLowerCase() ) ||
        other
    )[0],
    browser = ( /chrome|opera|safari|firefox|msie/.exec( ua ) || other )[0],
    version = parseFloat(
        ( /(?:version\/|chrome\/|firefox\/|msie\s|os )(\d+(?:[._]\d+)?)/.exec( ua )|| other )[1].replace( '_', '.' )
    ),
    cssPrefixes = {
        chrome: '-webkit-',
        firefox: '-moz-',
        msie: '-ms-',
        opera: '-o-',
        safari: '-webkit-',
        other: '-webkit-'
    },
    cssProps = {};

( function () {
    var el = document.createElement( 'div' ),
        style = el.style,
        props = {
            'box-shadow': {
                name: 'box-shadow',
                value: '0 0 0 #000'
            },
            transform: {
                name: 'transform',
                value: 'translateX(0)'
            },
            transform3d: {
                name: 'transform',
                value: 'translateZ(0)'
            },
            transition: {
                name: 'transition',
                value: 'all .3s'
            },
            perspective: {
                name: 'perspective',
                value: '1px'
            },
            'user-select': {
                name: 'user-select',
                value: 'none'
            }
        },
        prefix = cssPrefixes[ browser ],
        prop, test, css;

    for ( prop in props ) {
        test = props[ prop ];
        css = test.name + ':' + test.value;
        style.cssText = css;
        if ( style.length ) {
            cssProps[ prop ] = test.name;
        } else {
            style.cssText = prefix + css;
            cssProps[ prop ] = style.length ? prefix + test.name : null;
        }
    }
    style.cssText = 'display:flex';
    if ( style.length ) {
        cssProps.flexbox = 'flex';
    } else {
        style.cssText = 'display:' + prefix + 'flex';
        cssProps.flexbox = el.style.length ? prefix + 'flex' : null;
    }
    css = cssProps.transition;
    [ 'delay', 'timing', 'duration', 'property' ].forEach( function ( prop ) {
        cssProps[ 'transition-' + prop ] = css ? css + '-' + prop : null;
    });
    el = null;
    style = null;

    // Browser bugs:
    // 1. iOS5 Sometimes fails to transform stuff.
    // 2. Chrome on Windows XP has edge case bugs like
    //    not rendering scroll bars in transformed elements.
    if ( ( platform === 'ios' && version < 6 ) ||
            /windows nt 5.1/.test( ua ) ) {
        cssProps.transform3d = false;
    }
}() );

/**
    Namespace: O.UA

    The O.UA namespace contains information about which browser and platform the
    application is currently running on, and which CSS properties are supported.
*/
NS.UA = {
    /**
        Property: O.UA.platform
        Type: String

        The operating system being run: "mac", "win", "linux", "android",
        "ios", "webos" or "other.
    */
    platform: platform,

    /**
        Property: O.UA.isMac
        Type: Boolean

        True if running on a mac.
    */
    isMac: platform === 'mac',
    /**
        Property: O.UA.isWin
        Type: Boolean

        True if running on windows.
    */
    isWin: platform === 'win',
    /**
        Property: O.UA.isLinux
        Type: Boolean

        True if running on linux.
    */
    isLinux: platform === 'linux',
    /**
        Property: O.UA.isIOS
        Type: Boolean

        True if running on iOS.
    */
    isIOS: platform === 'ios',

    /**
        Property: O.UA.isAndroid
        Type: Boolean

        True if running on Android.
    */
    isAndroid: platform === 'android',

    /**
        Property: O.UA.browser
        Type: String

        The browser being run. "chrome", "firefox", "msie" or "opera" or
        "safari".
    */
    browser: browser,
    /**
        Property: O.UA.version
        Type: Number

        The browser version being run. This is a float, and includes the first
        minor revision as well as the major revision. For example, if the user
        is running Opera 12.5, this will be `12.5`, not just `12`.
    */
    version: version,

    /**
        Property: O.UA.chrome
        Type: Number

        If running Chrome, this will be the version number running. Otherwise 0.
    */
    chrome: browser === 'chrome' ? version : 0,
    /**
        Property: O.UA.firefox
        Type: Number

        If running Firefox, this will be the version number running. Otherwise
        0.
    */
    firefox: browser === 'firefox' ? version : 0,
    /**
        Property: O.UA.msie
        Type: Number

        If running Internet Explorer, this will be the version number running.
        Otherwise 0.
    */
    msie: browser === 'msie' ? version : 0,
    /**
        Property: O.UA.opera
        Type: Number

        If running Opera, this will be the version number running. Otherwise 0.
    */
    opera: browser === 'opera' ? version : 0,
    /**
        Property: O.UA.safari
        Type: Number

        If running Safari, this will be the version number running. Otherwise 0.
    */
    safari: browser === 'safari' ? version : 0,
    /**
        Property: O.UA.operaMobile
        Type: Number

        If running Opera Mobile, this will be the version number running.
        Otherwise 0.
    */
    operaMobile: /opera mobi/.test( ua ) ? version : 0,

    /**
        Property: O.UA.operaMini
        Type: Number

        If running Opera Mini, this will be the version number running.
        Otherwise 0.
    */
    operaMini: !!window.operamini ? version : 0,

    /**
        Property: O.UA.cssProps
        Type: Object

        A map of certain CSS property names to the browser-specific CSS property
        name required, or null if the browser does not support the property.

        The following properties are available: box-shadow, float, transform,
        transform3d, transition, transition-delay, transition-duration,
        transition-property and transition-timing.
    */
    cssProps: cssProps,
    /**
        Property: O.UA.cssPrefix
        Type: String

        The CSS prefix to use for this browser.
    */
    cssPrefix: cssPrefixes[ browser ],

    /**
        Property: O.UA.canTouch
        Type: Boolean

        Does the browser support touch events?
    */
    canTouch: 'ontouchstart' in document.documentElement
};

}( O ) );
