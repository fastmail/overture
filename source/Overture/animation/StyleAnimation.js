// -------------------------------------------------------------------------- \\
// File: StyleAnimation.js                                                    \\
// Module: Animation                                                          \\
// Requires: Core, DOM, Animation.js                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import Animation from './Animation.js';
import { Class, clone } from '../core/Core.js';
import Element from '../dom/Element.js';

var splitTransform = function ( transform ) {
    var result = [];
    var i = 0;
    var l = transform.length;
    var next = 0;

    while ( true ) {
        // Gather text part
        while ( next < l && /^[^,(]$/.test( transform.charAt( next ) ) ) {
            next += 1;
        }
        if ( next < l ) {
            next += 1;
            result.push( transform.slice( i, next ) );
            i = next;
        } else {
            result.push( transform.slice( i ) );
            return result;
        }

        // Gather number
        while ( /^[\s\d\-.]$/.test( transform.charAt( next ) ) ) {
            next += 1;
        }
        result.push( parseFloat( transform.slice( i, next ) ) );
        i = next;
    }
};

var numbersRe = /[.\-\d]/g;

var styleAnimators = {
    display: {
        calcDelta: function ( startValue, endValue ) {
            return endValue === 'none' ? startValue : endValue;
        },
        calcValue: function ( position, deltaValue, startValue ) {
            return position ? deltaValue : startValue;
        },
    },
    transform: {
        calcDelta: function ( startValue, endValue ) {
            var start = splitTransform( startValue ),
                end = splitTransform( endValue );
            if ( start.length !== end.length ) {
                start = [ startValue ];
                end = [ endValue ];
            }
            return {
                start: start,
                delta: end.map( function ( value, index ) {
                    return index & 1 ? value - start[ index ] : 0;
                }),
            };
        },
        calcValue: function ( position, deltaValue ) {
            var start = deltaValue.start,
                delta = deltaValue.delta,
                transform = start[0],
                i, l;
            for ( i = 1, l = start.length; i < l; i += 2 ) {
                transform += start[ i ] + ( position * delta[ i ] );
                transform += start[ i + 1 ];
            }
            return transform;
        },
    },
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

    opacity: 1,
};

/**
    Class: O.StyleAnimation

    Extends: O.Animation

    Animates the CSS styles of an element without using CSS transitions. This is
    used in browsers that don't support CSS transitions, but could also be
    useful if you want to animate an element using an easing method not
    supported by CSS transitions.

    Note, only the following CSS properties are currently supported by this
    class (all others will be set immediately without transition):

    * top
    * right
    * bottom
    * left
    * width
    * height
    * transform (values must be in matrix form)
    * opacity
*/
export default Class({

    Extends: Animation,

    /**
        Method (protected): O.StyleAnimation#prepare

        Goes through the new styles for the element, works out which of these
        can be animated, and caches the delta value (difference between end and
        start value) for each one to save duplicated calculation when drawing a
        frame.

        Parameters:
            styles - {Object} A map of style name to desired value.

        Returns:
            {Boolean} True if any of the styles are going to be animated.
    */
    prepare: function ( styles ) {
        var animated = this.animated = [],
            from = this.startValue = this.current,
            current = this.current = clone( from ),
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
                                start.replace( numbersRe, '' ) ) ||
                            ( typeof end === 'string' &&
                                end.replace( numbersRe, '' ) ) ||
                            // If no unit specified, using 0 will ensure
                            // the value passed to setStyle is a number, so
                            // it will add 'px' if appropriate.
                            0;
                        start = from[ property ] = parseInt( start, 10 );
                        delta[ property ] = parseInt( end, 10 ) - start;
                    }
                } else {
                    current[ property ] = end;
                    Element.setStyle( this.element, property, end );
                }
            }
        }
        return !!animated.length;
    },

    /**
        Method (protected): O.StyleAnimation#drawFrame

        Updates the animating styles on the element to the interpolated values
        at the position given.

        Parameters:
            position - {Number} The position in the animation.
    */
    drawFrame: function ( position ) {
        var animated = this.animated,
            l = animated.length,

            from = this.startValue,
            to = this.endValue,
            difference = this.deltaValue,
            units = this.units,
            current = this.current,

            el = this.element,
            setStyle = Element.setStyle,
            property, value, start, end, delta, unit, animator;

        while ( l-- ) {
            property = animated[l];

            // Calculate new value.
            start = from[ property ] || 0;
            end = to[ property ] || 0;
            delta = difference[ property ];
            unit = units[ property ];

            animator = styleAnimators[ property ];

            value = current[ property ] = position < 1 ?
                animator ?
                    animator.calcValue( position, delta, start, end ) :
                    ( start + ( position * delta ) ) + unit :
                end;

            // And set.
            setStyle( el, property, value );
        }
    },
});
