/*global navigator, document, window */

/**
    Module: UA

    The UA module contains information about the platform on which the
    application is running.
*/

const ua = navigator.userAgent.toLowerCase();
const other = [ 'other', '0' ];

/**
    Namespace: O.UA

    The O.UA namespace contains information about which browser and platform the
    application is currently running on, and which CSS properties are supported.
*/

/**
    Property: O.UA.platform
    Type: String

    The operating system being run: "mac", "win", "linux", "android",
    "ios" or "other".
*/
export const platform =
    /ip(?:ad|hone|od)/.test( ua ) ||
        ( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 ) ?
    'ios' :
    ( /android/.exec( ua ) ||
      /mac|win|linux/.exec( navigator.platform.toLowerCase() ) ||
      other
    )[0];

/**
    Property: O.UA.isMac
    Type: Boolean

    True if running on a mac.
*/
export const isMac = platform === 'mac';
/**
    Property: O.UA.isWin
    Type: Boolean

    True if running on windows.
*/
export const isWin = platform === 'win';
/**
    Property: O.UA.isLinux
    Type: Boolean

    True if running on linux.
*/
export const isLinux = platform === 'linux';
/**
    Property: O.UA.isIOS
    Type: Boolean

    True if running on iOS.
*/
export const isIOS = platform === 'ios';
/**
    Property: O.UA.isWKWebView
    Type: Boolean

    True if running on WKWebView in iOS.
*/
export const isWKWebView = platform === 'ios' && !!window.indexedDB;
/**
    Property: O.UA.isAndroid
    Type: Boolean

    True if running on Android.
*/
export const isAndroid = platform === 'android';

/**
    Property: O.UA.browser
    Type: String

    The browser being run. "chrome", "firefox", "msie", "edge" or "safari".
*/
export const browser = (
    /firefox|edge/.exec( ua ) ||
    /chrome|safari/.exec( ua ) ||
    ( /trident/.exec( ua ) ? [ 'msie' ] : other )
)[0];
/**
    Property: O.UA.version
    Type: Number

    The browser version being run. This is a float, and includes the first
    minor revision as well as the major revision. For example, if the user
    is running Opera 12.5, this will be `12.5`, not just `12`.
*/
export const version = parseFloat((
    /(?:; rv:|edge\/|version\/|firefox\/|os )(\d+(?:[._]\d+)?)/
        .exec( ua ) ||
    /chrome\/(\d+\.\d+)/.exec( ua ) ||
    other
)[1].replace( '_', '.' ) );

/**
    Property: O.UA.canTouch
    Type: Boolean

    Does the browser support touch events?
*/
export const canTouch = 'ontouchstart' in document.documentElement;

/**
    Property: O.UA.canU2F
    Type: Boolean

    Does the browser probably support U2F?
*/
// See http://caniuse.com/#feat=u2f
// Chrome 41+ supports it but exposes no obvious global; Firefox has it
// disabled by default but if enabled by security.webauth.u2f exposes a
// global called U2F.
export const canU2F = ( browser === 'chrome' && version >= 41 ) || !!window.U2F;
