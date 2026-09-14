/*
    Shared fixtures for the animation tests.

    The animation modules reach for navigator, document, window and Element at
    import time, so minimal stand-ins are installed before they are loaded.
    `matchMedia` returns a single query object whose `matches` the tests can
    flip to simulate the user asking for reduced motion.

    makeElement() returns a fake element recording every style set on it and
    every Web Animation started, each of which can be finished by hand; the
    real StyleAnimation class then runs against it unchanged.
*/

export const reducedMotionQuery = {
    matches: false,
    listeners: [],
    addListener(fn) {
        this.listeners.push(fn);
    },
    set(matches) {
        this.matches = matches;
        this.listeners.forEach((fn) => fn({ matches }));
    },
};

Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
    configurable: true,
});
globalThis.document = {
    documentElement: {},
    hidden: false,
    createElement: () => ({ style: { length: 1 } }),
};
globalThis.window = {
    matchMedia: () => reducedMotionQuery,
    console,
};
globalThis.Element = class Element {
    animate() {}
};
globalThis.CSS = { supports: () => true };
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);

const { StyleAnimation, cssEasing, fitCubicBezier } =
    await import('../../source/animation/StyleAnimation.js');
const Easing = await import('../../source/animation/Easing.js');

export { StyleAnimation, cssEasing, fitCubicBezier, Easing };

export const makeElement = () => {
    const element = {
        style: {},
        animations: [],
        animate(keyframes, options) {
            const animation = {
                keyframes,
                options,
                currentTime: 0,
                onfinish: null,
                isCancelled: false,
                cancel() {
                    this.isCancelled = true;
                },
                finish() {
                    this.currentTime = options.duration;
                    if (this.onfinish) {
                        this.onfinish();
                    }
                },
            };
            element.animations.push(animation);
            return animation;
        },
    };
    return element;
};

// Stands in for an O.AnimatableView: counts running animations and records
// the order of the will/did callbacks.
export const makeObject = () => ({
    animating: 0,
    events: [],
    willAnimate() {
        this.animating += 1;
        this.events.push('will');
    },
    didAnimate() {
        this.animating -= 1;
        this.events.push('did');
    },
});

// setStyle clears a style with null; a real element reports '' afterwards.
export const isUnset = (value) => value == null || value === '';

export const wait = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
