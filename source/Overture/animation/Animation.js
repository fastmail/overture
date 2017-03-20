// -------------------------------------------------------------------------- \\
// File: Animation.js                                                         \\
// Module: Animation                                                          \\
// Requires: Core, Foundation, Easing.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class, meta, extend } from '../core/Core.js';
import '../core/Array.js';  // For Array#erase
import RunLoop from '../foundation/RunLoop.js';
import Easing from './Easing.js';

// List of currently active animations
var animations = [];

// Draw the next frame in all currently active animations.
var nextFrame = function () {
    // Cache to local variable for speed
    var anims = animations,
        l = anims.length,
        time = RunLoop.frameStartTime,
        objAnimations, i,
        hasMultiple, animation, object, animTime, duration;

    if ( l ) {
        // Request first to get in shortest time.
        RunLoop.invokeInNextFrame( nextFrame );

        while ( l-- ) {
            objAnimations = anims[l];
            i = objAnimations.length;
            hasMultiple = i > 1;
            if ( hasMultiple ) {
                object = objAnimations[0].object;
                object.beginPropertyChanges();
            }
            while ( i-- ) {
                animation = objAnimations[i];
                animTime = time - animation.startTime;
                // For Safari 7, sigh.
                if ( animTime === time ) {
                    animation.startTime = time;
                    animTime = 0;
                }
                duration = animation.duration;
                if ( animTime < duration ) {
                    animation.drawFrame(
                        // Normalised position along timeline [0..1].
                        animation.ease( animTime / duration ),
                        // Normalised time animation has been running.
                        animTime,
                        false
                    );
                } else {
                    animation.drawFrame( 1, duration, true );
                    animation.stop();
                }
            }
            if ( hasMultiple ) {
                object.endPropertyChanges();
            }
        }
    }
};

/**
    Class: O.Animation

    At its core, O.Animation just repeatedly calls a method,
    <O.Animation#drawFrame>, over a given time period, supplying it with a
    number between 0 and 1 to tell it how far through the animation it currently
    is. This number is modified according to the easing function specified.

    The default implementation will set a numeric property on an object,
    interpolating between the initial value of the property and the value it's
    asked to transition to. If this is what you want to do, simply initialise
    your O.Animation instance with an "object" and a "property" value.

    For animating something other than a numeric property, override
    <O.Animation#prepare> and <O.Animation#drawFrame> methods.
*/
export default Class({

    init: function ( mixin ) {
        this.duration = this.duration;
        this.ease = this.ease;
        this.isRunning = false;
        this.startTime = 0;

        this.startValue = null;
        this.endValue = null;
        this.deltaValue = null;

        extend( this, mixin );
    },

    /**
        Property: O.Animation#duration
        Type: Number
        Default: 300

        The length, in milliseconds, that the animation should last.
    */
    duration: 300,

    /**
        Property: O.Animation#ease
        Type: Function
        Default: O.Easing.ease

        The easing function to use for the animation.
    */
    ease: Easing.ease,

    /**
        Property: O.Animation#isRunning
        Type: Boolean

        Is the animation currently in progress?
    */

    /**
        Property (private): O.Animation#startTime
        Type: Number

        A timestamp for when the animation began. Do not alter manually.
    */

    /**
        Property: O.Animation#object
        Type: Object

        The object on which to set the property during animation.
    */

    /**
        Property: O.Animation#property
        Type: String

        The name of the property to set on the object being animated.
    */

    /**
        Method: O.Animation#animate

        Transition to a new (given) value. If it is currently in the middle of
        an animation, that will be stopped and the new animation will transition
        from whatever the current value is to the new value.

        Parameters:
            value    - {*} The new value to animate to.
            duration - {Number} (optional) The length of the animation (in ms).
            ease     - {Function} (optional) The easing function to use.

        Returns:
            {O.Animation} Returns self.
    */
    animate: function ( value, duration, ease ) {
        if ( this.isRunning ) {
            this.stop();
        }
        if ( duration != null ) {
            this.duration = duration;
        }
        if ( ease != null ) {
            this.ease = ease;
        }

        // Prepare any values. Check we've actually got something to animate.
        if ( !this.prepare( value ) ) {
            return this;
        }

        var object = this.object,
            metadata = meta( object ),
            objAnimations = metadata.animations || ( metadata.animations = [] );

        this.startTime = 0;

        // Start loop if no current animations
        if ( !animations.length ) {
            RunLoop.invokeInNextFrame( nextFrame );
        }

        // And add objectAnimations to animation queue
        if ( !objAnimations.length ) {
            animations.push( objAnimations );
        }
        objAnimations.push( this );

        // Now running
        this.isRunning = true;
        // Let object know animation has begun.
        if ( object.willAnimate ) {
            object.willAnimate( this );
        }
        return this;
    },

    /**
        Method (protected): O.Animation#prepare

        Called at the beginning of a new animation to perform any calculations
        that are constant in every frame, or otherwise initialise the animation.

        Parameters:
            value - {*} The new value to be transitioned to.

        Returns:
            {Boolean} Is there anything to actually animate. Returns false if
            the value is already at the desired end point.
    */
    prepare: function ( value ) {
        if ( typeof value === 'object' ) {
            this.startValue = value.startValue;
            this.endValue = value.endValue;
        } else {
            this.startValue = this.object.get( this.property );
            this.endValue = value;
        }
        this.deltaValue = this.endValue - this.startValue;

        return !!this.deltaValue;
    },

    /**
        Method (protected): O.Animation#drawFrame

        Called 60 times a second (or as frequently as the browser can manage)
        whilst the animation is in progress to draw each frame in the animation.
        The default implementation just interpolates from the start (numeric)
        value to the end (numeric)value and sets the <#property> on the
        <#object> with the new value. Override this method to do something
        different when drawing a frame.

        Parameters:
            position - {Number} A number, normally between 0 and 1, giving the
                       position in the animation, modified by the easing
                       function (the easing function may cause the number to go
                       beyond 0 and 1).
    */
    drawFrame: function ( position, time, isLastFrame ) {
        // And interpolate to find new value.
        var value = isLastFrame ?
            this.endValue :
            this.startValue + ( position * this.deltaValue );

        this.object.set( this.property, value );
    },

    /**
        Method: O.Animation#stop

        Stop the animation (at the current position), if it is in progress.

        Returns:
            {O.Animation} Returns self.
    */
    stop: function () {
        if ( this.isRunning ) {
            // Remove from animation lists.
            var object = this.object,
                objAnimations = meta( object ).animations;
            objAnimations.erase( this );

            if ( !objAnimations.length ) {
                animations.erase( objAnimations );
            }
            // Not running any more
            this.isRunning = false;
            // Let object know animation has finished.
            if ( object.didAnimate ) {
                object.didAnimate( this );
            }
        }

        return this;
    },
});
