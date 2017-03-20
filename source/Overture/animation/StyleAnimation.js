import Animation from './Animation.js';
import { Class, clone } from '../core/Core.js';
import Element from '../dom/Element.js';

const splitTransform = function ( transform ) {
    const result = [];
    let i = 0;
    const l = transform.length;
    let next = 0;

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

const numbersRe = /[.\-\d]/g;

const styleAnimators = {
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
            let start = splitTransform( startValue ),
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
            const start = deltaValue.start;
            const delta = deltaValue.delta;
            let transform = start[0];
            for ( let i = 1, l = start.length; i < l; i += 2 ) {
                transform += start[ i ] + ( position * delta[ i ] );
                transform += start[ i + 1 ];
            }
            return transform;
        },
    },
};

const supported = {
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
        const animated = this.animated = [];
        const from = this.startValue = this.current;
        const current = this.current = clone( from );
        const delta = this.deltaValue = {};
        const units = this.units = {};

        this.endValue = styles;

        for ( const property in styles ) {
            let start = from[ property ] || 0;
            const end = styles[ property ] || 0;
            if ( start !== end ) {
                // We only support animating key layout properties.
                if ( supported[ property ] ) {
                    animated.push( property );
                    const animator = styleAnimators[ property ];
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
        const animated = this.animated;
        let l = animated.length;

        const from = this.startValue;
        const to = this.endValue;
        const difference = this.deltaValue;
        const units = this.units;
        const current = this.current;

        const el = this.element;
        const setStyle = Element.setStyle;

        while ( l-- ) {
            const property = animated[l];

            // Calculate new value.
            const start = from[ property ] || 0;
            const end = to[ property ] || 0;
            const delta = difference[ property ];
            const unit = units[ property ];

            const animator = styleAnimators[ property ];

            const value = current[ property ] = position < 1 ?
                animator ?
                    animator.calcValue( position, delta, start, end ) :
                    ( start + ( position * delta ) ) + unit :
                end;

            // And set.
            setStyle( el, property, value );
        }
    },
});
