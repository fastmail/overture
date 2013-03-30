// -------------------------------------------------------------------------- \\
// File: CSSStyleAnimation.js                                                 \\
// Module: Animation                                                          \\
// Requires: Core, Foundation, Easing.js                                      \\
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
var canTransform3d = !!NS.UA.cssProps.transform3d;

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

var CSSStyleAnimation = NS.Class({

    init: function ( mixin ) {
        this._deadMan = null;

        this.duration = 300;
        this.ease = NS.Easing.ease;
        this.isRunning = false;
        this.animating = [];
        this.current = null;

        NS.extend( this, mixin );
    },

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
            animating = this.animating,
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

            if ( object && object.willAnimate ) {
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
            if ( object && object.didAnimate ) {
                object.didAnimate( this );
            }
        }
        return this;
    }
});

NS.CSSStyleAnimationController = CSSStyleAnimationController;
NS.CSSStyleAnimation = CSSStyleAnimation;

}( this.O ) );
