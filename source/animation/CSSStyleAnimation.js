/*global document */

import { Class } from '../core/Core';
import RunLoop from '../foundation/RunLoop';
import Element from '../dom/Element';
import Easing from './Easing';
import CSSStyleAnimationController from './CSSStyleAnimationController';

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

/**
    Class: O.CSSStyleAnimation

    Animates the CSS properties of an element using CSS transitions. When
    initialised, you should set the <#element> property to the element you wish
    to animate and the <#current> property to an object of the current styles
    on the object.
*/
const CSSStyleAnimation = Class({

    init ( mixin ) {
        this._deadMan = null;

        this.duration = 300;
        this.ease = Easing.ease;
        this.isRunning = false;
        this.animating = [];
        this.current = null;

        Object.assign( this, mixin );
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
    animate ( styles, duration, ease ) {
        if ( this.isRunning ) {
            this.stop();
        }
        if ( duration != null ) {
            this.duration = duration;
        }
        if ( ease != null ) {
            this.ease = ease;
        }

        const el = this.element;
        const current = this.current;
        const animating = this.animating;
        const object = this.object;
        const setStyle = Element.setStyle;

        this.current = styles;

        for ( const property in styles ) {
            const value = styles[ property ];
            if ( value !== current[ property ] ) {
                animating.push( property );
                setStyle( el, property, value );
            }
        }

        if ( animating.length ) {
            setStyle( el, 'transition',
                'all ' + this.duration + 'ms ' + this.ease.cssName );

            this.isRunning = true;
            // If the CSS property was transitioning from x -> y, and now we ask
            // it to transition from y -> x, it may already be at x, even though
            // the style attribute reads as y. In this case, it may not fire a
            // transitionend event. Set a timeout for 100ms after the duration
            // as a deadman switch to rescue it in this case.
            this._deadMan = RunLoop.invokeAfterDelay(
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
    transitionEnd ( property ) {
        const animating = this.animating;
        const index = animating.indexOf( property );
        if ( index > -1 ) {
            animating.splice( index, 1 );
            if ( !animating.length ) { this.stop(); }
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
    stop () {
        if ( this.isRunning ) {
            this.isRunning = false;
            this.animating.length = 0;
            RunLoop.cancel( this._deadMan );

            CSSStyleAnimationController.deregister( this.element );

            Element.setStyle( this.element, 'transition', 'none' );

            const object = this.object;
            if ( object && object.didAnimate ) {
                object.didAnimate( this );
            }
        }
        return this;
    },
});

export default CSSStyleAnimation;
