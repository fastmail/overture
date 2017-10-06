/*global navigator, document, window */

import '../foundation/Enumerable';  // For Array#forEach on ES3 browsers?
// TODO(cmorgan/modulify) remove this alleged dependency, we use a ES5 baseline.

/**
    Module: UA

    The UA module contains information about the platform on which the
    application is running.
*/

const ua = navigator.userAgent.toLowerCase();
const other = [ 'other', '0' ];
const platform = /windows phone/.test( ua ) ? 'winphone' :
    /ip(?:ad|hone|od)/.test( ua ) ? 'ios' : (
    /android|webos/.exec( ua ) ||
    /mac|win|linux/.exec( navigator.platform.toLowerCase() ) ||
    other
)[0];
let browser = (
    /firefox|edge|msie|iemobile|opr\//.exec( ua ) ||
    /chrome|safari|opera/.exec( ua ) ||
    other
)[0];
const version = parseFloat((
    /(?:; rv:|edge\/|version\/|firefox\/|opr\/|msie\s|os )(\d+(?:[._]\d+)?)/
        .exec( ua ) ||
    /chrome\/(\d+\.\d+)/.exec( ua ) ||
    other
)[1].replace( '_', '.' ) );
const prefix = {
    firefox: '-moz-',
    msie: '-ms-',
    opera: '-o-',
}[ browser ] || '-webkit-';
const cssProps = {};

if ( browser === 'opr/' ) {
    browser = 'opera';
}

( function () {
    const props = {
        'box-shadow': {
            name: 'box-shadow',
            value: '0 0 0 #000',
        },
        transform: {
            name: 'transform',
            value: 'translateX(0)',
        },
        transform3d: {
            name: 'transform',
            value: 'translateZ(0)',
        },
        transition: {
            name: 'transition',
            value: 'all .3s',
        },
        perspective: {
            name: 'perspective',
            value: '1px',
        },
        'user-select': {
            name: 'user-select',
            value: 'none',
        },
    };
    const el = document.createElement( 'div' );
    const style = el.style;

    for ( const prop in props ) {
        const test = props[ prop ];
        const css = style.cssText = test.name + ':' + test.value;
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
        cssProps.flexbox = style.length ? prefix + 'flex' : null;
    }
    const css = cssProps.transition;
    [ 'delay', 'timing', 'duration', 'property' ].forEach( prop => {
        cssProps[ 'transition-' + prop ] = css ? css + '-' + prop : null;
    });

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
export default {
    /**
        Property: O.UA.platform
        Type: String

        The operating system being run: "mac", "win", "linux", "android",
        "ios", "webos" or "other.
    */
    platform,

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
        Property: O.UA.isWKWebView
        Type: Boolean

        True if running on WKWebView in iOS.
    */
    isWKWebView: platform === 'ios' && !!window.indexedDB,
    /**
        Property: O.UA.isAndroid
        Type: Boolean

        True if running on Android.
    */
    isAndroid: platform === 'android',
    /**
        Property: O.UA.isWinPhone
        Type: Boolean

        True if running on Windows Phone.
    */
    isWinPhone: platform === 'winphone',

    /**
        Property: O.UA.browser
        Type: String

        The browser being run. "chrome", "firefox", "msie", "edge", "opera",
        "safari" or "iemobile".
    */
    browser,
    /**
        Property: O.UA.version
        Type: Number

        The browser version being run. This is a float, and includes the first
        minor revision as well as the major revision. For example, if the user
        is running Opera 12.5, this will be `12.5`, not just `12`.
    */
    version,

    /**
        Property: O.UA.chrome
        Type: Number

        If running Chrome, this will be the version number running. Otherwise 0.
    */
    chrome: browser === 'chrome' ? version : 0,
    /**
        Property: O.UA.safari
        Type: Number

        If running Safari, this will be the version number running. Otherwise 0.
    */
    safari: browser === 'safari' ? version : 0,
    /**
        Property: O.UA.firefox
        Type: Number

        If running Firefox, this will be the version number running. Otherwise
        0.
    */
    firefox: browser === 'firefox' ? version : 0,
    /**
        Property: O.UA.edge
        Type: Number

        If running Edge, this will be the version number running. Otherwise
        0.
    */
    edge: browser === 'edge' ? version : 0,
    /**
        Property: O.UA.msie
        Type: Number

        If running Internet Explorer, this will be the version number running.
        Otherwise 0.
    */
    msie: browser === 'msie' ? version : 0,
    /**
        Property: O.UA.iemobile
        Type: Number

        If running Mobile Internet Explorer, this will be the version number
        running. Otherwise 0.
    */
    iemobile: browser === 'iemobile' ? version : 0,
    /**
        Property: O.UA.opera
        Type: Number

        If running Opera, this will be the version number running. Otherwise 0.
    */
    opera: browser === 'opera' ? version : 0,
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
    operaMini: window.operamini ? version : 0,

    /**
        Property: O.UA.cssProps
        Type: Object

        A map of certain CSS property names to the browser-specific CSS property
        name required, or null if the browser does not support the property.

        The following properties are available: box-shadow, float, transform,
        transform3d, transition, transition-delay, transition-duration,
        transition-property and transition-timing.
    */
    cssProps,
    /**
        Property: O.UA.cssPrefix
        Type: String

        The CSS prefix to use for this browser.
    */
    cssPrefix: prefix,

    /**
        Property: O.UA.canTouch
        Type: Boolean

        Does the browser support touch events?
    */
    canTouch: 'ontouchstart' in document.documentElement,

    /**
        Property: O.UA.canU2F
        Type: Boolean

        Does the browser support U2F?
    */
    // TODO: Find a way of detecting this rather than hardcoding
    // For now, referencing http://caniuse.com/#feat=u2f
    canU2F: browser === 'chrome' && version >= 41,
};
