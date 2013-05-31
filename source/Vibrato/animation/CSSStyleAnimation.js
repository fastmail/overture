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

/**
    Object: O.CSSStyleAnimationController

    Monitors for transitionend events and notifies the relevant
    CSSStyleAnimation class that its animation has finished.
    There is normally no reason to interact with this object directly.
*/
var CSSStyleAnimationController = {
    /**
        Property: O.CSSStyleAnimationController.animations
        Type: Object

        Maps elements (by guid) to transitions currently occurring on them.
    */
    animations: {},

    /**
        Method: O.CSSStyleAnimationController.register

        Associates an element with the <O.CSSStyleAnimation> object that is
        managing its animation.

        Parameters:
            el        - {Element} The element being animated.
            animation - {O.CSSStyleAnimation} The animation controller.
    */
    register: function ( el, animation ) {
        this.animations[ NS.guid( el ) ] = animation;
    },

    /**
        Method: O.CSSStyleAnimationController.deregister

        Removes an element and its animation controller from the <#animations>
        map.

        Parameters:
            el - {Element} The element that was being animated.
    */
    deregister: function ( el ) {
        delete this.animations[ NS.guid( el ) ];
    },

    /**
        Method: O.CSSStyleAnimationController.handleEvent

        Handles the transitionend event. Notifies the relevant animation
        controller that the transition has finished.

        Parameters:
            event - {Event} The transitionend event object.
    */
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

/**
    Class: O.CSSStyleAnimation

    Animates the CSS properties of an element using CSS transitions. When
    initialised, you should set the <#element> property to the element you wish
    to animate and the <#current> property to an object of the current styles
    on the object.
*/
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

    /**
        Property: O.CSSStyleAnimation#duration
        Type: Number
        Default: 300

        The length, in milliseconds, that the animation should last.
    */

    /**
        Property: O.CSSStyleAnimation#ease
        Type: Function
        Default: O.Easing.ease

        The easing function to use for the animation. Must be one with a CSS
        transition equivalent.
    */

    /**
        Property: O.CSSStyleAnimation#isRunning
        Type: Boolean

        Is the animation currently in progress?
    */

    /**
        Property: O.CSSStyleAnimation#element
        Type: Element

        The element this <O.CSSStyleAnimation> instance is animating.
    */

    /**
        Property: O.CSSStyleAnimation#current
        Type: Object

        The current styles applied to the element.
    */

    /**
        Method: O.CSSStyleAnimation#animate

        Transition the element to a new set of styles.

        Parameters:
            styles   - {Object} The new styles for the element.
            duration - {Number} (optional) The length of the animation (in ms).
            ease     - {Function} (optional) The easing function to use.

        Returns:
            {O.CSSStyleAnimation} Returns self.
    */
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

    /**
        Method: O.CSSStyleAnimation#transitionEnd

        Called by <O.CSSStyleAnimationController> when a style finishes
        transitioning on the element.

        Parameters:
            property - {String} The name of the style that has finished
                       transitioning.
    */
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

    /**
        Method: O.CSSStyleAnimation#stop

        Stops the animation, if it is in progress. Note, this will immediately
        transition the styles to the end value of the current animation. It
        will not leave them in their partway point.

        Returns:
            {O.CSSStyleAnimation} Returns self.
    */
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
