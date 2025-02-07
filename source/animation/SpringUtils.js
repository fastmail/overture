import { limit } from '../core';
import { bouncelessSpring } from './Easing';

/**
    Function (private): O.SpringUtil#estimateSpringDuration

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
const createSpringTransition = ({ mass, stiffness, velocity, offset } = {}) => {
    const easing = bouncelessSpring({ velocity, mass, stiffness, offset });
    const duration = estimateSpringDuration(easing);
    return { duration, easing };
};

/**
    Function: O.SpringUtils#createScreenTransition

    Utility for creating an animation with good defaults for an iOS-like
    stack navigator screen transition.

    Parameters:
        velocity - {Number} (optional) see `O.Easing#bouncelessSpring`
        offset - {Number} (optional) see `O.Easing#bouncelessSpring`

    Returns:
        {Object} see `O.SpringUtils#createSpringTransition
 */
const createScreenTransition = (velocity = 1, offset = 0) =>
    createSpringTransition({
        velocity: limit(velocity, 0, 10),
        offset,
        mass: 0.23,
        stiffness: 30,
    });

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
