// -------------------------------------------------------------------------- \\
// File: AnimatableView.js                                                    \\
// Module: Animation                                                          \\
// Requires: Core, UA, Animation.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global document */

"use strict";

( function ( NS ) {

/*
    Usage

    new CSSStyleAnimation({ element: el }).animate({
        opacity: 0,
        height: '300px',
        transform: 'foo'
    }, 300, ease ).wait( 40 ).animate({
        opacity: 1
    }, 250, ease );

    Will animate from current values
*/

var CSSStyleAnimationController = {
    animations: {},
    register: function ( el, animation ) {
        this.animations[ NS.guid( el ) ] = animation;
    },
    deregister: function ( el ) {
        delete this.animations[ NS.guid( el ) ];
    },
    handleEvent: function ( event ) {
        var animation = this.animations[ NS.guid( event.target ) ],
            property = event.propertyName;
        if ( animation ) {
            event.stopPropagation();
            animation.transitionEnd(
                Object.keyOf( NS.UA.cssProps, property ) || property,
                event.elapsedTime
            );
        }
    }.invokeInRunLoop()
};
[ 'transitionend', 'webkitTransitionEnd', 'oTransitionEnd' ].forEach(
function ( type ) {
    document.addEventListener( type, CSSStyleAnimationController, true );
});

var canTransform3d = !!NS.UA.cssProps.transform3d;

var CSSStyleAnimation = NS.Class({

    init: function ( mixin ) {
        NS.extend( this, mixin );
    },

    isRunning: false,

    object: {},

    ease: NS.Easing.ease,
    duration: 300,

    _deadMan: null,

    animate: function ( styles, duration, ease ) {
        if ( this.isRunning ) {
            this.stop();
        }
        if ( duration != null ) {
            this.duration = duration;
        }
        if ( ease != null ) {
            this.ease = ease;
        }

        var el = this.element,
            current = this.current,
            animating = this.animating = [],
            object = this.object,
            setStyle = NS.Element.setStyle,
            property, value;

        this.current = styles;

        setStyle( el, 'transition',
            'all ' + this.duration + 'ms ' + this.ease.cssName );

        for ( property in styles ) {
            value = styles[ property ];
            if ( value !== current[ property ] ) {
                animating.push( property );
                if ( property === 'transform' && canTransform3d ) {
                    value += ' translateZ(0)';
                }
                setStyle( el, property, value );
            }
        }

        if ( animating.length ) {
            this.isRunning = true;
            // If the CSS property was transitioning from x -> y, and now we ask
            // it to transition from y -> x, it may already be at x, even though
            // the style attribute reads as y. In this case, it may not fire a
            // transitionend event. Set a timeout for 100ms after the duration
            // as a deadman switch to rescue it in this case.
            this._deadMan = NS.RunLoop.invokeAfterDelay(
                this.stop, this.duration + 100, this );

            if ( object.willAnimate ) {
                object.willAnimate( this );
            }

            CSSStyleAnimationController.register( el, this );
        }

        return this;
    },

    transitionEnd: function ( property ) {
        var animating = this.animating,
            index = animating.indexOf( property );
        if ( index > -1 ) {
            animating.splice( index, 1 );
            if ( !animating.length ) { this.stop(); }
        }
        if ( property === 'transform' && canTransform3d ) {
            NS.Element.setStyle(
                this.element, 'transform', this.current.transform );
        }
    },

    stop: function () {
        if ( this.isRunning ) {
            this.isRunning = false;
            this.animating.length = 0;
            NS.RunLoop.cancel( this._deadMan );

            CSSStyleAnimationController.deregister( this.element );

            NS.Element.setStyle( this.element, 'transition', 'none' );

            var object = this.object;
            if ( object.didAnimate ) {
                object.didAnimate( this );
            }
        }
        return this;
    }
});

NS.CSSStyleAnimation = CSSStyleAnimation;

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
        calcValue: function ( position, deltaValue, startValue, endValue ) {
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
            from = this.from = this.current,
            current = this.current = NS.clone( from ),
            delta = this.delta = {},

            property, start, end, animator;

        this.to = styles;

        for ( property in styles ) {
            start = from[ property ] || 0;
            end = styles[ property ] || 0;
            if ( start !== end ) {
                // We only support animating key layout properties.
                if ( supported[ property ] ) {
                    animated.push( property );
                    animator = styleAnimators[ property ];
                    delta[ property ] = animator ?
                        animator.calcDelta( start, end ) :
                        end - start;
                } else {
                    current[ property ] = end;
                    NS.Element.setStyle( this.element, property, end );
                }
            }
        }
        return !!animated.length;
    },

    drawFrame: function ( position, time ) {
        var animated = this.animated,
            l = animated.length,

            from = this.from,
            to = this.to,
            difference = this.delta,
            current = this.current,

            el = this.element,
            setStyle = NS.Element.setStyle,
            property, value, start, end, delta, animator;

        while ( l-- ) {
            property = animated[l];

            // Calculate new value.
            start = from[ property ] || 0;
            end = to[ property ] || 0;
            delta = difference[ property ];
            animator = styleAnimators[ property ];

            value = current[ property ] = animator ?
                animator.calcValue( position, delta, start, end ) :
                position < 1 ? start + ( position * delta ) : end;

            // And set.
            setStyle( el, property, value );
        }
    }
});

NS.StyleAnimation = StyleAnimation;

NS.AnimatableView = {

    animateLayer: true,
    animateLayerDuration: 300,
    animateLayerEasing: NS.Easing.ease,

    animating: 0,
    willAnimate: function () {
        this.increment( 'animating', 1 );
    },
    didAnimate: function () {
        this.increment( 'animating', -1 );
    },

    layerAnimation: function () {
        var Animation = NS.UA.cssProps.transition ?
            CSSStyleAnimation : StyleAnimation;
        return new Animation({
            object: this,
            element: this.get( 'layer' )
        });
    }.property(),

    redrawLayerStyles: function ( layer, oldStyles ) {
        var newStyles = this.get( 'layerStyles' ),
            layerAnimation = this.get( 'layerAnimation' ),
            setStyle = NS.Element.setStyle,
            property, value;

        // Animate
        if ( this.get( 'animateLayer' ) ) {
            if ( !layerAnimation.current ) {
                layerAnimation.current = oldStyles || newStyles;
            }
            layerAnimation.animate(
                newStyles,
                this.get( 'animateLayerDuration' ),
                this.get( 'animateLayerEasing' )
            );
        }
        // Or just set.
        else {
            layerAnimation.stop();
            layerAnimation.current = newStyles;
            setStyle( layer, 'transition-property', 'none' );
            for ( property in newStyles ) {
                value = newStyles[ property ];
                if ( value !== oldStyles[ property ] ) {
                    setStyle( layer, property, value );
                }
            }
        }
    }
};

}( this.O ) );
