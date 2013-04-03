// -------------------------------------------------------------------------- \\
// File: StyleAnimation.js                                                    \\
// Module: Animation                                                          \\
// Requires: Animation.js                                                     \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/*
    If the browser doesn't support CSS Transitions, fall back to manual. We
    don't bother implementing everything though. Unsupported:

    Non-px units for length.
    Colours.
    String values.
    Automatic reverse transitions.
*/

var matrix = /matrix\((.*?)\)/;
var styleAnimators = {
    display: {
        calcDelta: function ( startValue, endValue ) {
            return endValue === 'none' ? startValue : endValue;
        },
        calcValue: function ( position, deltaValue, startValue, endValue ) {
            return position ? position < 1 ?
                deltaValue : endValue : startValue;
        }
    },
    transform: {
        calcDelta: function ( startValue, endValue ) {
            if ( !startValue ) { startValue = 'matrix(1,0,0,1,0,0)'; }
            if ( !endValue ) { endValue = 'matrix(1,0,0,1,0,0)'; }
            var start = matrix.exec( startValue )[1].split( ',' ).map( Number ),
                end = matrix.exec( endValue )[1].split( ',' ).map( Number );
            return {
                start: start,
                delta: end.map( function ( value, index ) {
                    return value - start[ index ];
                })
            };
        },
        calcValue: function ( position, deltaValue ) {
            var start = deltaValue.start, delta = deltaValue.delta;
            return 'matrix(' + start.map( function ( value, index ) {
                return value + ( position * delta[ index ] );
            }).join( ',' ) + ')' +
            ( NS.UA.cssProps.transform3d ? ' translateZ(0)' : '' );
        }
    }
};

var supported = {
    display: 1,

    top: 1,
    right: 1,
    bottom: 1,
    left: 1,

    width: 1,
    height: 1,

    transform: 1,

    opacity: 1
};

var StyleAnimation = NS.Class({

    Extends: NS.Animation,

    prepare: function ( styles ) {
        var animated = this.animated = [],
            from = this.startValue = this.current,
            current = this.current = NS.clone( from ),
            delta = this.deltaValue = {},
            units = this.units = {},

            property, start, end, animator;

        this.endValue = styles;

        for ( property in styles ) {
            start = from[ property ] || 0;
            end = styles[ property ] || 0;
            if ( start !== end ) {
                // We only support animating key layout properties.
                if ( supported[ property ] ) {
                    animated.push( property );
                    animator = styleAnimators[ property ];
                    if ( animator ) {
                        delta[ property ] = animator.calcDelta( start, end );
                    } else {
                        units[ property ] =
                            ( typeof start === 'string' &&
                                start.replace( /[\-\d]/g, '' ) ) ||
                            ( typeof end === 'string' &&
                                end.replace( /[\-\d]/g, '' ) ) ||
                            'px';
                        start = from[ property ] = parseInt( start, 10 );
                        delta[ property ] = parseInt( end, 10 ) - start;
                    }
                } else {
                    current[ property ] = end;
                    NS.Element.setStyle( this.element, property, end );
                }
            }
        }
        return !!animated.length;
    },

    drawFrame: function ( position ) {
        var animated = this.animated,
            l = animated.length,

            from = this.startValue,
            to = this.endValue,
            difference = this.deltaValue,
            units = this.units,
            current = this.current,

            el = this.element,
            setStyle = NS.Element.setStyle,
            property, value, start, end, delta, unit, animator;

        while ( l-- ) {
            property = animated[l];

            // Calculate new value.
            start = from[ property ] || 0;
            end = to[ property ] || 0;
            delta = difference[ property ];
            unit = units[ property ];

            animator = styleAnimators[ property ];

            value = current[ property ] = animator ?
                animator.calcValue( position, delta, start, end ) :
                position < 1 ? ( start + ( position * delta ) ) + unit : end;

            // And set.
            setStyle( el, property, value );
        }
    }
});

NS.StyleAnimation = StyleAnimation;

}( this.O ) );
