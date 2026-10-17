import { limit } from '../core';
import { bouncelessSpring } from './Easing';

/**
    Function (private): O.SpringUtils#estimateSpringDuration

    Provides an estimated duration of the given easing function.

    Parameters:
        easing      - {Function} An easing function that takes a value in [0..1]
                      and returns a value in [0..1]
        maxDuration - {Number} A limit for the returned duration in milliseconds

    Returns:
        {Number} The estimated duration of the animation in milliseconds
 */
const estimateSpringDuration = (easing, maxDuration = 1000) => {
    maxDuration /= 1000;
    const timestep = 1 / 120;
    let elapsedDuration = 0;
    let isDone = false;
    do {
        elapsedDuration += timestep;
        isDone = Math.abs(1 - easing(elapsedDuration)) < timestep;
    } while (!isDone && elapsedDuration < maxDuration);
    return elapsedDuration * 1000;
};

/**
    Function: O.SpringUtils#createSpringTransition

    Utility for creating a spring based animation.

    Parameters:
        springOptions - {Object} (optional) see O.Easing#bouncelessSpring

    Returns:
        {Object} An object with easing and duration properties, described below:

        - duration: {Number} the estimated duration of the animation
        - easing: {Function} the easing function that describes the animation
 */
const createSpringTransition = (springOptions) => {
    const easing = bouncelessSpring(springOptions);
    const duration = estimateSpringDuration(easing);
    return { duration, easing };
};

// The spring of a UINavigationController push on iOS 26 and 27, measured
// from UIKit: critically damped, starting from rest, with this angular
// frequency in radians per second.
const SCREEN_FREQUENCY = 22;

// The spring these transitions are expressed in, which sets the scale of
// the velocity passed in: 1 is a speed of sqrt(30 / 0.23) times the
// distance per second of spring time.
const SCREEN_SPRING = { mass: 0.23, stiffness: 30 };

// A transition ends this close to its destination, under half a pixel on
// a phone-width move.
const SCREEN_SETTLED = 0.001;

/**
    Function: O.SpringUtils#createScreenTransition

    Utility for creating an animation that matches an iOS stack navigator
    screen transition. With no velocity or offset, the motion is the same as
    a UINavigationController push on iOS 26 and 27, and the duration ends
    once it is visibly finished. The velocity is rounded to the nearest
    quarter so transitions can be shared: the CSS form of a spring is worked
    out once per easing function, and that can take a few milliseconds just
    as the animation starts.

    Parameters:
        velocity - {Number} (optional) see `O.Easing#bouncelessSpring`
        offset - {Number} (optional) see `O.Easing#bouncelessSpring`

    Returns:
        {Object} see `O.SpringUtils#createSpringTransition
 */
const screenTransitions = new Map();
const createScreenTransition = (velocity = 0, offset = 0) => {
    velocity = Math.round(limit(velocity, 0, 10) * 4) / 4;
    const key = velocity + ',' + offset;
    let transition = screenTransitions.get(key);
    if (!transition) {
        const spring = bouncelessSpring({
            ...SCREEN_SPRING,
            velocity,
            offset,
        });
        // Find how long the spring takes to settle, in its own time, then
        // play exactly that much of it, at the speed that gives the
        // native frequency in real time.
        let settled = 0;
        do {
            settled += 0.001;
        } while (
            Math.abs(1 - spring(settled)) >= SCREEN_SETTLED &&
            settled < 5
        );
        const frequency = Math.sqrt(
            SCREEN_SPRING.stiffness / SCREEN_SPRING.mass,
        );
        transition = {
            duration: ((settled * frequency) / SCREEN_FREQUENCY) * 1000,
            easing: (x) => spring(x * settled),
        };
        screenTransitions.set(key, transition);
    }
    return transition;
};

/**
    Property: O.SpringUtils#defaultScreenTransition
    Type: Object

    A default easing and duration for creating a screen transition animation
 */
const defaultScreenTransition = createScreenTransition();

export {
    createSpringTransition,
    createScreenTransition,
    defaultScreenTransition,
};
