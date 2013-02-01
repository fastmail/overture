// -------------------------------------------------------------------------- \\
// File: Animation.js                                                         \\
// Module: Animation                                                          \\
// Requires: Core, Foundation, Easing.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global window, performance */

"use strict";

( function ( NS, win ) {

var requestAnimFrame =
    win.requestAnimationFrame       ||
    win.oRequestAnimationFrame      ||
    win.webkitRequestAnimationFrame ||
    win.mozRequestAnimationFrame    ||
    win.msRequestAnimationFrame     ||
    ( function () {
        var lastTime = 0;
        return function ( callback ) {
            var time = Date.now(),
                timeToNextCall = Math.max( 0, 16 - ( time - lastTime ) );
                lastTime = time;
            win.setTimeout( function () {
                callback( time + timeToNextCall );
            }, timeToNextCall );
        };
    }() );

var animations = [];

var nextFrame = function ( time ) {
    // Cache to local variable for speed
    var anims = animations,
        l = anims.length,
        objAnimations, i,
        hasMultiple, animation, object, animTime, duration;

    if ( l ) {
        // Request first to get in shortest time.
        requestAnimFrame( nextFrame );

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
                duration = animation.duration;
                if ( animTime < duration ) {
                    animation.drawFrame(
                        // Normalised position along timeline [0..1].
                        animation.ease( animTime / duration ),
                        // Normalised time animation has been running.
                        animTime
                    );
                } else {
                    animation.drawFrame( 1, duration );
                    animation.stop();
                }
            }
            if ( hasMultiple ) {
                object.endPropertyChanges();
            }
        }
    }
}.invokeInRunLoop();

var meta = NS.meta;
var timestamp = Date;

// Feature detect what timestamp is actually passed to the requestAnimFrame
// method
var then = timestamp.now();
requestAnimFrame( function ( time ) {
    // Older Webkit gives a high-resolution timestamp, which may actually be a
    // few milliseconds before then. Add a second to it to ensure this isn't a
    // factor.
    if ( time + 1000 < then ) {
        timestamp = performance;
        // For Chrome v21-23 (inclusive):
        if ( !timestamp.now ) {
            timestamp.now = timestamp.webkitNow;
        }
    }
});

NS.Animation = NS.Class({

    init: function ( mixin ) {
        NS.extend( this, mixin );
    },

    object: null,
    property: 'value',

    ease: NS.Easing.ease,
    duration: 300,

    startTime: 0,
    isRunning: false,

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

        this.startTime = timestamp.now();

        // Start loop if no current animations
        if ( !animations.length ) {
            requestAnimFrame( nextFrame );
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

    prepare: function ( obj ) {
        if ( typeof obj === 'object' ) {
            this.startValue = obj.startValue;
            this.endValue = obj.endValue;
        } else {
            this.startValue = this.object.get( this.property );
            this.endValue = obj;
        }
        this.deltaValue = this.endValue - this.startValue;

        return !!this.deltaValue;
    },

    drawFrame: function ( position, time ) {
        // And interpolate to find new value.
        var value = position < 1 ?
            this.startValue + ( position * this.deltaValue ) :
            this.endValue;

        this.object.set( this.property, value );
    },

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
    }
});

}( this.O, window ) );
