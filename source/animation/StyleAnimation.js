import { setStyle } from '../dom/Element.js';
import { cancel, invoke, invokeAfterDelay } from '../foundation/RunLoop.js';
import { prefersReducedMotion } from './Animation.js';
import { cubicBezier, ease } from './Easing.js';

// ---

/*global CSS, Element */

const supportsWebAnimations =
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function';

const supportsLinearEasing =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timing-function', 'linear(0, 1)');

const LINEAR_EASING_SAMPLES = 40;

const piecewiseLinear = (samples) => (x) => {
    const last = samples.length - 1;
    if (x <= 0) {
        return samples[0];
    }
    if (x >= 1) {
        return samples[last];
    }
    const scaled = x * last;
    const index = Math.floor(scaled);
    return (
        samples[index] +
        (samples[index + 1] - samples[index]) * (scaled - index)
    );
};

const FIT_SAMPLES = 20;

/**
    Function (private): O.StyleAnimation.fitCubicBezier

    Finds the cubic bezier closest to an arbitrary easing function, for
    browsers without CSS `linear()` (Safari before 17.2). The control points
    are searched on a coarse grid, with the second point's y fixed at 1 so
    the curve comes to rest like the springs it stands in for; the standard
    `ease` and `ease-out` curves are more than 0.3 out on those springs,
    where this gets within about 0.05. It runs once per easing function.

    Parameters:
        easing - {Function} An easing function taking a value in [0..1] and
                 returning the progress at that point.

    Returns:
        {Function} A cubic bezier easing from <O.Easing.cubicBezier>.
*/
const fitCubicBezier = (easing) => {
    const target = [];
    for (let i = 1; i < FIT_SAMPLES; i += 1) {
        target.push(easing(i / FIT_SAMPLES));
    }
    let best = null;
    let bestError = Infinity;
    for (let x1 = 0; x1 <= 10; x1 += 1) {
        for (let y1 = 0; y1 <= 10; y1 += 1) {
            for (let x2 = 0; x2 <= 10; x2 += 1) {
                const candidate = cubicBezier(x1 / 10, y1 / 10, x2 / 10, 1);
                let error = 0;
                for (let i = 0; i < target.length; i += 1) {
                    error += Math.abs(
                        candidate((i + 1) / FIT_SAMPLES) - target[i],
                    );
                    if (error >= bestError) {
                        break;
                    }
                }
                if (error < bestError) {
                    bestError = error;
                    best = candidate;
                }
            }
        }
    }
    return best;
};

/**
    Function: O.StyleAnimation.cssEasing

    Returns the CSS timing function equivalent to a JS easing function.

    Cubic beziers (and linear) carry their exact CSS form on `cssName`.
    Anything else, such as the springs from <O.SpringUtils>, is sampled into
    a CSS `linear()` function where the browser supports it, otherwise the
    closest cubic bezier is used (see <fitCubicBezier>). The JS curve matching
    what the browser actually runs is stored on the function as
    `cssEquivalent`, so an interrupted animation can work out where it had
    got to.

    Parameters:
        easing - {Function} An easing function taking a value in [0..1] and
                 returning the progress at that point.

    Returns:
        {String} A value for CSS `animation-timing-function`.
*/
const cssEasing = (easing) => {
    if (!easing.cssName) {
        if (supportsLinearEasing) {
            const samples = [];
            for (let i = 0; i <= LINEAR_EASING_SAMPLES; i += 1) {
                samples.push(
                    Math.round(easing(i / LINEAR_EASING_SAMPLES) * 10000) /
                        10000,
                );
            }
            easing.cssName = 'linear(' + samples.join(', ') + ')';
            easing.cssEquivalent = piecewiseLinear(samples);
        } else {
            const bezier = fitCubicBezier(easing);
            easing.cssName = bezier.cssName;
            easing.cssEquivalent = bezier;
        }
    }
    return easing.cssName;
};

const evaluateEasing = (easing, x) => (easing.cssEquivalent || easing)(x);

// --- Values

const numbersRe = /[.\-\d]+/g;

// A transform we can shift vertically, so a change in `top` can be run on
// the compositor instead.
const translate3dRe =
    /^translate3d\(\s*([^,]+?)\s*,\s*(-?[\d.]+)(?:px)?\s*,\s*0(?:px)?\s*\)$/;

// Properties interpolated by the browser. Anything else in the styles is set
// immediately, except display and overflow which are handled specially.
const interpolable = new Set([
    'top',
    'right',
    'bottom',
    'left',

    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',

    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',

    'width',
    'height',

    'transform',

    'opacity',
]);

// What the element is presumed to look like when the property is not set,
// so it can be animated in from, or out to, its absence.
const initialValues = {
    opacity: 1,
    transform: 'none',
};

const isNumeric = (value) =>
    (typeof value === 'number' && isFinite(value)) ||
    (typeof value === 'string' && isFinite(parseFloat(value)));

const isPx = (value) =>
    typeof value === 'number' || /^-?[\d.]+(?:px)?$/.test(value);

const unitOf = (property, from, to) => {
    for (const value of [from, to]) {
        if (typeof value === 'string') {
            const unit = value.replace(numbersRe, '');
            if (unit) {
                return unit;
            }
        }
    }
    return property === 'opacity' ? '' : 'px';
};

// The value as the browser needs it in a keyframe. Also used to compare
// values, so `10` and `'10px'` (or `''` and `'none'`) are seen as equal.
const cssString = (property, value) => {
    if (typeof value === 'number') {
        return property === 'opacity' ? String(value) : value + 'px';
    }
    if (property === 'transform' && !value) {
        return 'none';
    }
    return value;
};

const canShiftY = (transform) =>
    transform === 'none' || translate3dRe.test(transform);

const shiftY = (transform, dy) => {
    if (transform === 'none') {
        return 'translate3d(0,' + dy + 'px,0)';
    }
    const match = translate3dRe.exec(transform);
    return match
        ? 'translate3d(' +
              match[1] +
              ',' +
              (parseFloat(match[2]) + dy) +
              'px,0)'
        : null;
};

const splitTransform = (transform) => {
    const result = [];
    const length = transform.length;
    let last = 0;
    let inFn = false;
    let inNumber = false;

    for (let i = 0; i < length; i += 1) {
        const character = transform.charAt(i);
        if ((inNumber || inFn) && inNumber !== /^[.\-\d]/.test(character)) {
            const part = transform.slice(last, i);
            result.push(inNumber ? parseFloat(part) : part);
            last = i;
            inNumber = !inNumber;
        } else if (character === '(') {
            inFn = true;
        } else if (character === ')') {
            inFn = false;
        }
    }
    result.push(transform.slice(last));
    return result;
};

const zeroTransform = (parts) => {
    parts = parts.slice();
    for (let i = 1, length = parts.length; i < length; i += 2) {
        parts[i] = 0;
    }
    return parts;
};

const interpolateTransform = (startValue, endValue, position) => {
    let start = splitTransform(startValue || '');
    let end = splitTransform(endValue || '');
    if (!endValue || endValue === 'none') {
        end = zeroTransform(start);
    }
    if (!startValue || startValue === 'none') {
        start = zeroTransform(end);
    }
    // Different functions or argument counts can't be interpolated here;
    // the browser will have jumped to the end value.
    if (start.length !== end.length) {
        return endValue;
    }
    let transform = start[0];
    for (let i = 1, length = start.length; i < length; i += 2) {
        let suffix = start[i + 1];
        // A bare 0 has no unit; take it from the end value.
        if (start[i] === 0 && /^[,)]/.test(suffix)) {
            suffix = end[i + 1].replace(/[,)].*/g, '') + suffix;
        }
        transform += start[i] + position * (end[i] - start[i]);
        transform += suffix;
    }
    return transform;
};

const interpolate = (property, from, to, position) => {
    if (property === 'transform') {
        return interpolateTransform(from, to, position);
    }
    const start = parseFloat(from);
    return (
        start + (parseFloat(to) - start) * position + unitOf(property, from, to)
    );
};

// --- StyleAnimation

/**
    Class: O.StyleAnimation

    Animates changes to the inline styles of an element. The new styles are
    set on the element immediately and the browser is asked, via the Web
    Animations API, to animate from the old values to the new ones, so
    changes to `transform` and `opacity` run on the compositor thread and
    stay smooth while the main thread is busy. A change to `top` in px is
    also run as a `transform` where possible, so that repositioning items in
    a list stays off the main thread.

    Only the following properties are animated (the rest are set
    immediately):

    * top, right, bottom, left
    * marginTop, marginRight, marginBottom, marginLeft
    * paddingTop, paddingRight, paddingBottom, paddingLeft
    * width, height
    * transform
    * opacity

    `display` and `overflow` are flipped at whichever end of the animation
    keeps the content visible: `display: none` and a non-hidden `overflow`
    are applied when the animation finishes, other values at the start.

    The <#object> is told when an animation starts and finishes via its
    `willAnimate` and `didAnimate` methods, if it has them.
*/
class StyleAnimation {
    /**
        Property: O.StyleAnimation#object
        Type: Object

        The object to notify when an animation begins and ends.
    */

    /**
        Property: O.StyleAnimation#element
        Type: Element

        The element whose styles are animated.
    */

    /**
        Property: O.StyleAnimation#isRunning
        Type: Boolean

        Is the animation currently in progress?
    */

    /**
        Property: O.StyleAnimation#current
        Type: Object|null

        The inline styles currently set on the element, as a map of property
        name to value. Set this before the first <#animate> if the element
        already has styles applied.
    */

    /**
        Property: O.StyleAnimation#animated
        Type: String[]|null

        The properties changed by the current (or most recent) animation.
    */

    constructor(mixin) {
        this.object = null;
        this.element = null;
        this.isRunning = false;
        this.current = null;
        this.animated = null;

        this._frames = null;
        this._animation = null;
        this._endStyles = null;
        this._timer = null;

        Object.assign(this, mixin);
    }

    /**
        Method: O.StyleAnimation#animate

        Animate the element to the given styles. If an animation is already
        in progress it is stopped, and the new one starts from wherever the
        element had got to.

        Parameters:
            styles   - {Object} A map of style name to desired value. A value
                       of undefined removes the style.
            duration - {Number} (optional) The length of the animation in ms.
            easing   - {Function} (optional) The easing function to use.

        Returns:
            {O.StyleAnimation} Returns self.
    */
    animate(styles, duration, easing) {
        const element = this.element;
        if (this.isRunning) {
            this._interrupt();
        }
        const from = this.current || {};
        if (duration != null) {
            this.duration = duration;
        }
        if (easing) {
            this.ease = easing;
        }
        duration = prefersReducedMotion() ? 0 : this.duration;

        const animated = (this.animated = []);
        const frames = {};
        let endStyles = null;

        for (const { property, from: previous, to } of this._changes(styles)) {
            if (to === undefined) {
                const initial = initialValues[property];
                if (initial !== undefined) {
                    frames[property] = {
                        property,
                        from: previous,
                        to: initial,
                    };
                    animated.push(property);
                }
                setStyle(element, property, null);
            } else if (property === 'display' || property === 'overflow') {
                const applyNow =
                    property === 'display' ? to !== 'none' : to === 'hidden';
                if (applyNow) {
                    setStyle(element, property, to);
                } else {
                    if (!endStyles) {
                        endStyles = {};
                    }
                    endStyles[property] = to;
                    this.current[property] = previous;
                }
                animated.push(property);
            } else {
                if (interpolable.has(property)) {
                    // A value the browser can't interpolate, such as 'auto'
                    // or a property that was not set before, still counts
                    // as animated so the change is held for the duration
                    // and the view learns of its new size at the end.
                    const start = previous ?? initialValues[property];
                    if (
                        property === 'transform' ||
                        (isNumeric(start) && isNumeric(to))
                    ) {
                        frames[property] = { property, from: start, to };
                    }
                    animated.push(property);
                }
                setStyle(element, property, to);
            }
        }

        // Run a change in top as a transform, keeping it on the compositor.
        // The element is already at its new top, so the transform starts
        // offset by the distance moved and animates back to the real one.
        const topFrame = frames.top;
        if (topFrame && isPx(topFrame.from) && isPx(topFrame.to)) {
            const fromTransform = cssString('transform', from.transform);
            const toTransform = cssString('transform', this.current.transform);
            const shifted = shiftY(
                fromTransform,
                parseFloat(topFrame.from) - parseFloat(topFrame.to),
            );
            if (shifted && canShiftY(toTransform)) {
                delete frames.top;
                frames.transform = {
                    property: 'transform',
                    from: shifted,
                    to: toTransform,
                };
                if (!animated.includes('transform')) {
                    animated.push('transform');
                }
            }
        }

        if (!animated.length) {
            return this;
        }

        const keyframes = Object.values(frames);
        this.isRunning = true;
        this._endStyles = endStyles;
        this._frames = keyframes;

        if (supportsWebAnimations && keyframes.length && duration) {
            const start = {};
            const end = {};
            for (const frame of keyframes) {
                const property = frame.property;
                start[property] = cssString(property, frame.from);
                end[property] = cssString(property, frame.to);
            }
            try {
                const animation = element.animate([start, end], {
                    duration,
                    easing: cssEasing(this.ease),
                });
                animation.onfinish = () =>
                    invoke(this._animationDidFinish, this);
                this._animation = animation;
            } catch {
                // Rejected keyframes or easing: the element is already
                // showing the end state, so just wait out the duration.
            }
        }
        if (!this._animation) {
            this._timer = invokeAfterDelay(this._finish, duration, this);
        }

        const object = this.object;
        if (object && object.willAnimate) {
            object.willAnimate(this);
        }
        return this;
    }

    /**
        Method: O.StyleAnimation#set

        Set the element to the given styles immediately, stopping any
        animation in progress.

        Parameters:
            styles - {Object} A map of style name to desired value. A value
                     of undefined removes the style.

        Returns:
            {O.StyleAnimation} Returns self.
    */
    set(styles) {
        this.stop();
        const element = this.element;
        for (const { property, to } of this._changes(styles)) {
            setStyle(element, property, to ?? null);
        }
        return this;
    }

    /**
        Method: O.StyleAnimation#stop

        Stop the animation, if it is in progress. The element jumps to the
        end state of the animation.

        Returns:
            {O.StyleAnimation} Returns self.
    */
    stop() {
        if (this.isRunning) {
            this._stop();
        }
        return this;
    }

    // Walks the difference between the styles on the element and the new
    // ones, replacing `current` with the new styles as it goes. Yields each
    // property whose inline style has to change, with `to` undefined when
    // it is being removed. A property appearing or disappearing is a change
    // even when its value matches the browser default: the inline style
    // differs, and the caller asked for it.
    *_changes(styles) {
        const from = this.current || {};
        const current = (this.current = {});
        for (const property in from) {
            if (
                styles[property] === undefined &&
                from[property] !== undefined
            ) {
                yield { property, from: from[property], to: undefined };
            }
        }
        for (const property in styles) {
            const to = styles[property];
            if (to === undefined) {
                continue;
            }
            current[property] = to;
            const previous = from[property];
            if (
                previous === undefined ||
                cssString(property, previous) !== cssString(property, to)
            ) {
                yield { property, from: previous, to };
            }
        }
    }

    // Stop part way through, leaving the element where it visually is. The
    // interpolated values are written as its inline styles and to `current`,
    // so the next animation starts from them and `current` stays an exact
    // record of what is on the element. A deferred display or overflow
    // change is dropped.
    _interrupt() {
        const element = this.element;
        const current = this.current;
        const duration = this.duration;
        const animation = this._animation;
        let position = 1;
        if (animation && duration) {
            const time = Number(animation.currentTime) || 0;
            position = evaluateEasing(this.ease, Math.min(time / duration, 1));
        }
        for (const { property, from, to } of this._frames) {
            const value = interpolate(property, from, to, position);
            current[property] = value;
            setStyle(element, property, value);
        }
        this._endStyles = null;
        this._stop();
    }

    _animationDidFinish() {
        if (this.isRunning) {
            this._finish();
        }
    }

    _stop() {
        const animation = this._animation;
        if (animation) {
            animation.onfinish = null;
            animation.cancel();
        }
        this._finish();
    }

    _finish() {
        const element = this.element;
        const endStyles = this._endStyles;
        for (const property in endStyles) {
            setStyle(element, property, endStyles[property]);
            this.current[property] = endStyles[property];
        }
        if (this._timer) {
            cancel(this._timer);
        }
        this._endStyles = null;
        this._frames = null;
        this._animation = null;
        this._timer = null;
        this.isRunning = false;

        const object = this.object;
        if (object && object.didAnimate) {
            object.didAnimate(this);
        }
    }
}

/**
    Property: O.StyleAnimation#duration
    Type: Number
    Default: 300

    The length, in milliseconds, that the animation should last.
*/
StyleAnimation.prototype.duration = 300;

/**
    Property: O.StyleAnimation#ease
    Type: Function
    Default: O.Easing.ease

    The easing function to use for the animation.
*/
StyleAnimation.prototype.ease = ease;

export { StyleAnimation, cssEasing, fitCubicBezier };
