import { limit } from '../core/Math.js';
import { bouncelessSpring } from './Easing.js';

// A transition ends this close to its destination, under half a pixel on
// a phone-width move.
const SETTLED = 0.001;

// How long, in seconds, a spring takes to come within SETTLED of its
// destination for good. Searching back from the end finds when a bouncy
// spring last leaves that range, not when it first passes through it.
const settleTime = (spring) => {
    let time = 2;
    while (time > 0 && Math.abs(1 - spring(time - 0.001)) < SETTLED) {
        time -= 0.001;
    }
    return time;
};

// Plays a spring, given as its progress at time t (seconds), in real time
// until it settles.
const springTransition = (spring) => {
    const settled = settleTime(spring);
    return {
        duration: settled * 1000,
        easing: (x) => spring(x * settled),
    };
};

/**
    Function: O.SpringUtils#createSpringTransition

    Utility for creating a spring based animation.

    Parameters:
        springOptions - {Object} (optional) see O.Easing#bouncelessSpring

    Returns:
        {Object} An object with easing and duration properties, described below:

        - duration: {Number} how long the spring takes to settle, in ms
        - easing: {Function} the easing function that describes the animation
 */
const createSpringTransition = (springOptions) => {
    return springTransition(bouncelessSpring(springOptions));
};

// The spring of a UINavigationController push on iOS 26 and 27, measured
// from UIKit: critically damped, starting from rest, with this angular
// frequency in radians per second.
const SCREEN_FREQUENCY = 22;

/**
    Property: O.SpringUtils#defaultScreenTransition
    Type: Object

    An easing and duration matching an iOS stack navigator screen
    transition: the same motion as a UINavigationController push on iOS 26
    and 27, ending once it is visibly finished.
 */
const defaultScreenTransition = (() => {
    const omega = SCREEN_FREQUENCY;
    // Progress at time t (seconds), starting at rest.
    return springTransition((t) => 1 - (1 + omega * t) * Math.exp(-omega * t));
})();

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
    second so transitions can be shared: the keyframes for a spring are
    fitted once per easing function (see <O.StyleAnimation>).

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
        transition = springTransition(spring);
        releaseTransitions.set(velocity, transition);
    }
    return transition;
};

export {
    createSpringTransition,
    createReleaseTransition,
    defaultScreenTransition,
};
