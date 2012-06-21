// -------------------------------------------------------------------------- \\
// File: UA.js                                                                \\
// Module: UA                                                                 \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global navigator, document */

"use strict";

( function ( NS ) {

var ua = navigator.userAgent.toLowerCase(),
    other = [ 'other', 0 ],
    platform = /ip(?:ad|hone|od)/.test( ua ) ? 'ios' : (
        /mac|win|linux/.exec( navigator.platform.toLowerCase() ) ||
        /android|webos/.exec( ua ) ||
        other
    )[0],
    browser = ( /chrome|opera|safari|firefox|msie/.exec( ua ) || other )[0],
    version = parseFloat(
        ( /(?:version\/|chrome\/|firefox\/|msie\s)(\d+(?:\.\d+)?)/.exec( ua ) ||
          other
        )[1]
    ),
    cssPrefixes = {
        chrome: '-webkit-',
        firefox: '-moz-',
        msie: '-ms-',
        opera: '-o-',
        safari: '-webkit-'
    },
    cssProps = {
        'float': document.body.style.cssFloat !== undefined ?
            'cssFloat' : 'styleFloat'
    };

NS.UA = {
    // Platform
    platform: platform,

    isMac: platform === 'mac',
    isWin: platform === 'win',
    isLinux: platform === 'linux',
    isIOS: platform === 'ios',

    // Browser
    browser: browser,
    version: version,

    chrome: browser === 'chrome' ? version : 0,
    firefox: browser === 'firefox' ? version : 0,
    msie: browser === 'msie' ? version : 0,
    opera: browser === 'opera' ? version : 0,
    safari: browser === 'safari' ? version : 0,

    // Rendering engine
    gecko: /gecko\//.test( ua ),
    presto: /presto/.test( ua ),
    trident: /trident/.test( ua ),
    webkit: /webkit/.test( ua ),

    // CSS names
    cssProps: cssProps,
    cssPrefix: cssPrefixes[ browser ]
};

( function () {
    var el = document.createElement( 'div' ),
        props = {
            boxShadow: {
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
            }
        },
        prefix = cssPrefixes[ browser ],
        prop, test, css;

    for ( prop in props ) {
        test = props[ prop ];
        css = test.name + ':' + test.value;
        el.style.cssText = css;
        if ( el.style.length ) {
            cssProps[ prop ] = test.name;
        } else {
            el.style.cssText = prefix + css;
            cssProps[ prop ] = el.style.length ?
                prefix + test.name : null;
        }
    }
    css = cssProps.transition;
    [ 'delay', 'timing', 'duration', 'property' ].forEach( function ( prop ) {
        cssProps[ 'transition-' + prop ] = css ? css + '-' + prop : null;
    });
    el = null;
}() );

}( this.O ) );
