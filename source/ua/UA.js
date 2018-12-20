/*global navigator, document, window */

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
const browser = (
    /firefox|edge|msie/.exec( ua ) ||
    /chrome|safari/.exec( ua ) ||
    other
)[0];
const version = parseFloat((
    /(?:; rv:|edge\/|version\/|firefox\/|msie\s|os )(\d+(?:[._]\d+)?)/
        .exec( ua ) ||
    /chrome\/(\d+\.\d+)/.exec( ua ) ||
    other
)[1].replace( '_', '.' ) );
const prefix = {
    firefox: '-moz-',
    msie: '-ms-',
}[ browser ] || '-webkit-';

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

        The browser being run. "chrome", "firefox", "msie", "edge" or "safari".
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

        Does the browser probably support U2F?
    */
    // See http://caniuse.com/#feat=u2f
    // Chrome 41+ supports it but exposes no obvious global; Firefox has it
    // disabled by default but if enabled by security.webauth.u2f exposes a
    // global called U2F.
    canU2F: ( browser === 'chrome' && version >= 41 ) || !!window.U2F,
};
