/*global document, navigator */

/**
    Module: UA

    The UA module contains information about the platform on which the
    application is running.
*/

const ua = navigator.userAgent.toLowerCase();
const other = ['other', '0'];
// Support loading UA in workers, which don't define document
const documentElement =
    typeof document !== 'undefined' ? document.documentElement : {};

/**
    Namespace: O.UA

    The O.UA namespace contains information about which browser and platform the
    application is currently running on, and which CSS properties are supported.
*/

/**
    Property: O.UA.platform
    Type: String

    The operating system being run: "mac" (macOS), "win" (Windows), "linux"
    (varying Linuxes), "android" (Android), "ios" (iOS or iPadOS) or "other".
*/
export const platform =
    /ip(?:ad|hone|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        ? 'ios'
        : (/android/.exec(ua) ||
              /mac|win|linux/.exec(navigator.platform.toLowerCase()) ||
              other)[0];

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

    True if running on iOS (or iPadOS).
*/
export const isIOS = platform === 'ios';
/**
    Property: O.UA.isAndroid
    Type: Boolean

    True if running on Android.
*/
export const isAndroid = platform === 'android';
/**
    Property: O.UA.isApple
    Type: Boolean

    True if running on an Apple platform (macOS, iPadOS or iOS).
*/
export const isApple = isMac || isIOS;

/**
    Property: O.UA.browser
    Type: String

    The browser being run. "chrome", "firefox", "edge" or "safari".
*/
export const browser = (/firefox|edge/.exec(ua) ||
    /chrome|safari/.exec(ua) ||
    other)[0];
/**
    Property: O.UA.version
    Type: Number

    The browser version being run. This is a float, and includes the first
    minor revision as well as the major revision. For example, if the user
    is running Opera 12.5, this will be `12.5`, not just `12`.
*/
export const version = parseFloat(
    (/(?:; rv:|edge\/|version\/|firefox\/|os )(\d+(?:[._]\d+)?)/.exec(ua) ||
        /chrome\/(\d+\.\d+)/.exec(ua) ||
        other)[1].replace('_', '.'),
);

/**
    Property: O.UA.canTouch
    Type: Boolean

    Does the browser support touch events?
*/
export const canTouch = 'ontouchstart' in documentElement;
