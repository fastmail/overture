// -------------------------------------------------------------------------- \\
// File: AnimatableView.js                                                    \\
// Module: Animation                                                          \\
// Requires: Core, UA, Animation.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O, document */

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
    deregister: function ( el, animation ) {
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
    }
};
[ 'transitionend', 'webkitTransitionEnd',
        'oTransitionEnd', ' MSTransitionEnd' ].forEach( function ( type ) {
    document.addEventListener( type, CSSStyleAnimationController, true );
});

var CSSStyleAnimation = NS.Class({
    
    init: function ( options ) {
        NS.extend( this, options );
    },
    
    isRunning: false,
    
    object: {},
    
    ease: NS.Easing.ease,
    duration: 300,
    
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
                setStyle( el, property, value );
            }
        }
        
        if ( animating.length ) {
            this.isRunning = true;
            
            if ( object.willAnimate ) {
                object.willAnimate( this );
            }
            
            CSSStyleAnimationController.register( el, this );
        }
        
        return this;
    },
    
    transitionEnd: function ( property, elapsedTime ) {
        var animating = this.animating,
            index = animating.indexOf( property );
        if ( index > -1 ) {
            animating.splice( index, 1 );
            if ( !animating.length ) { this.stop(); }
        }
    },
    
    stop: function () {
        if ( this.isRunning ) {
            this.isRunning = false;
            this.animating.length = 0;
            
            CSSStyleAnimationController.deregister( this.element, this );
            
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
    
    current: {},
    
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
            property, value, start, end, delta, transition, animator;
        
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
            element: this.get( 'layer' ),
            current: this._layerStyles || this.get( 'layerStyles' )
        });
    }.property(),
    
    updateLayerStyles: function () {
        if ( this.isDestroyed ) { return; }
        
        var oldStyles = this._layerStyles,
            newStyles = this.get( 'layerStyles' ),
            deltaStyles = {},
            layer = this.get( 'layer' ),
            layerAnimation = this.get( 'layerAnimation' ),
            setStyle = NS.Element.setStyle,
            property, value;
        
        delete this._layerStyles;
                
        // Animate
        if ( this.get( 'animateLayer' ) ) {
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
            setStyle( layer, 'transition', 'none' );
            for ( property in newStyles ) {
                value = newStyles[ property ];
                if ( value !== oldStyles[ property ] ) {
                    setStyle( layer, property, value );
                }
            }
        }
    }
};

}( O ) );