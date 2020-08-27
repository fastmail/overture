import { meta } from '../core/Core';
import '../core/Array';  // For Array#erase
import * as RunLoop from '../foundation/RunLoop';
import Easing from './Easing';

// Does the used prefer reduced motion?
const reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion:reduce)'
);

let reduceMotion = reduceMotionQuery.matches;
reduceMotionQuery.addListener( ev => reduceMotion = ev.matches );

// List of currently active animations
const animations = [];

// Draw the next frame in all currently active animations.
const nextFrame = function () {
    // Cache to local variable for speed
    const anims = animations;
    let l = anims.length;
    const time = RunLoop.frameStartTime;

    if ( l ) {
        // Request first to get in shortest time.
        RunLoop.invokeInNextFrame( nextFrame );

        while ( l-- ) {
            const objAnimations = anims[l];
            let i = objAnimations.length;
            const hasMultiple = i > 1;
            let object;
            if ( hasMultiple ) {
                object = objAnimations[0].object;
                object.beginPropertyChanges();
            }
            while ( i-- ) {
                const animation = objAnimations[i];
                let animTime = animation.startTime;
                // We start the animation clock at the first frame *after* the
                // animation begins. This is becaues there are often a lot of
                // changes happening as well as the animation beginning, and
                // it's better to start the animation a frame later than have
                // a slow first frame and thus stuttery start to the animation
                if ( animTime <= 0 ) {
                    if ( !animTime ) {
                        animation.startTime = -1;
                        continue;
                    }
                    animation.startTime = animTime = time;
                }
                animTime = time - animTime;
                const duration = animation.duration;
                if ( animTime < duration && !reduceMotion ) {
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
export default class Animation {
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

    constructor ( mixin ) {
        this.isRunning = false;
        this.startTime = 0;

        this.startValue = null;
        this.endValue = null;
        this.deltaValue = null;

        Object.assign( this, mixin );
    }

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
    animate ( value, duration, ease ) {
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

        const object = this.object;
        const metadata = meta( object );
        const objAnimations = metadata.animations ||
            ( metadata.animations = [] );

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
    }

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
    prepare ( value ) {
        if ( typeof value === 'object' ) {
            this.startValue = value.startValue;
            this.endValue = value.endValue;
        } else {
            this.startValue = this.object.get( this.property );
            this.endValue = value;
        }
        this.deltaValue = this.endValue - this.startValue;

        return !!this.deltaValue;
    }

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
    drawFrame ( position, time, isLastFrame ) {
        // And interpolate to find new value.
        const value = isLastFrame ?
            this.endValue :
            this.startValue + ( position * this.deltaValue );

        this.object.set( this.property, value );
    }

    /**
        Method: O.Animation#stop

        Stop the animation (at the current position), if it is in progress.

        Returns:
            {O.Animation} Returns self.
    */
    stop () {
        if ( this.isRunning ) {
            // Remove from animation lists.
            const object = this.object;
            const objAnimations = meta( object ).animations;
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
    }
}

/**
    Property: O.Animation#duration
    Type: Number
    Default: 300

    The length, in milliseconds, that the animation should last.
*/
Animation.prototype.duration = 300;

/**
    Property: O.Animation#ease
    Type: Function
    Default: O.Easing.ease

    The easing function to use for the animation.
*/
Animation.prototype.ease = Easing.ease;
