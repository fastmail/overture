import { limit } from '../core/Math.js';
import { bouncelessSpring } from './Easing.js';

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

// The spring a page settles with after the finger lifts from an iOS swipe
// back, measured from UIKit on iOS 27: its angular frequency in radians per
// second, and damping ratio. It is slightly bouncy, unlike a push.
const RELEASE_FREQUENCY = 21;
const RELEASE_DAMPING = 0.85;

// The fastest release, as a multiple of the distance still to go per second.
// Releasing right next to the destination would otherwise ask for a huge
// overshoot to carry the finger's speed.
const RELEASE_MAX_VELOCITY = 60;

/**
    Function: O.SpringUtils#createReleaseTransition

    Utility for creating the animation for a page settling after the user
    lets go of a swipe, matching iOS: a slightly underdamped spring that
    carries on at the finger's speed, so a fast flick overshoots and settles
    back, and a release moving away from the destination turns round first.
    The velocity is rounded to the nearest quarter of the distance per
    second so transitions can be shared (see <createScreenTransition>).

    Parameters:
        velocity - {Number} The page's speed at release, in px/s.
        distance - {Number} How far the page still has to go, in px. A
                   velocity with the opposite sign is moving away from the
                   destination.

    Returns:
        {Object} see `O.SpringUtils#createSpringTransition`; the easing may
        go below 0 or above 1.
 */
const releaseTransitions = new Map();
const createReleaseTransition = (velocity, distance) => {
    // As a fraction of the distance still to go per second.
    velocity = distance
        ? limit(
              velocity / distance,
              -RELEASE_MAX_VELOCITY,
              RELEASE_MAX_VELOCITY,
          )
        : 0;
    velocity = Math.round(velocity * 4) / 4;
    let transition = releaseTransitions.get(velocity);
    if (!transition) {
        const omega = RELEASE_FREQUENCY;
        const decay = RELEASE_DAMPING * omega;
        const damped = omega * Math.sqrt(1 - RELEASE_DAMPING * RELEASE_DAMPING);
        // Progress at time t (seconds), starting at 0 with the given speed
        // and settling on 1.
        const spring = (t) =>
            1 -
            Math.exp(-decay * t) *
                (Math.cos(damped * t) +
                    ((decay - velocity) / damped) * Math.sin(damped * t));
        let settled = 2;
        while (
            settled > 0 &&
            Math.abs(1 - spring(settled - 0.001)) < SCREEN_SETTLED
        ) {
            settled -= 0.001;
        }
        transition = {
            duration: settled * 1000,
            easing: (x) => spring(x * settled),
        };
        releaseTransitions.set(velocity, transition);
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
    createReleaseTransition,
    defaultScreenTransition,
};
