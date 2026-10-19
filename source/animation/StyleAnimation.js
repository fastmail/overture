import { limit } from '../core/Math.js';
import { setStyle } from '../dom/Element.js';
import { cancel, invoke, invokeAfterDelay } from '../foundation/RunLoop.js';
import { isIOS } from '../ua/UA.js';
import { prefersReducedMotion } from './Animation.js';
import { ease } from './Easing.js';

// ---

/*global Element */

const supportsWebAnimations =
    typeof Element !== 'undefined' &&
    typeof Element.prototype.animate === 'function';

// How far a spline piece may stray from the curve before it is split: under
// half a pixel on a phone-width move.
const SPLINE_TOLERANCE = 0.001;

// The shortest piece, so a curve the pieces can't follow still ends up with
// a bounded number of keyframes.
const SPLINE_MIN_LENGTH = 1 / 64;

const SLOPE_STEP = 1e-4;

const round = (number) => Math.round(number * 10000) / 10000;

const slopeAt = (easing, x) => {
    const x0 = Math.max(0, x - SLOPE_STEP);
    const x1 = Math.min(1, x + SLOPE_STEP);
    return (easing(x1) - easing(x0)) / (x1 - x0);
};

// The cubic going from 0 to 1 over u in [0..1] with the given slopes at each
// end, as drawn by cubic-bezier(1/3, s0/3, 2/3, 1 - s1/3).
const hermite = (s0, s1) => (u) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return 3 * u2 - 2 * u3 + s0 * (u3 - 2 * u2 + u) + s1 * (u3 - u2);
};

const identity = (u) => u;

const evaluateSpline = (pieces) => (x) => {
    const last = pieces.length - 1;
    if (x <= 0) {
        return pieces[0].progress;
    }
    if (x >= 1) {
        return pieces[last].progress;
    }
    let index = 1;
    while (pieces[index].offset <= x) {
        index += 1;
    }
    const from = pieces[index - 1];
    const to = pieces[index];
    return (
        from.progress +
        (to.progress - from.progress) *
            from.shape((x - from.offset) / (to.offset - from.offset))
    );
};

/**
    Function (private): O.StyleAnimation.splineEasing

    Fits a spline to an easing function with no CSS form, such as the springs
    from <O.SpringUtils>, so it can be played as keyframes: each piece is a
    keyframe whose easing is the cubic bezier matching the curve's value and
    slope at both ends, and pieces are split until they are within
    SPLINE_TOLERANCE of the curve. Keyframes with bezier easings are used
    rather than a CSS `linear()` timing function because WebKit will only
    run an animation on the compositor with cubic bezier easings; a
    `linear()` easing puts it back on the main thread. Each keyframe costs
    the browser a style resolution when the animation starts, which is why
    the pieces follow the curve's shape rather than being evenly spaced.

    The spline is fitted once and stored on the function.

    Parameters:
        easing - {Function} An easing function taking a value in [0..1] and
                 returning the progress at that point.

    Returns:
        {Object} The keyframes as `pieces`, one per keyframe in offset order
        with `offset`, `progress` and, on all but the last, the CSS `easing`
        to the next; and the curve the browser actually runs as `evaluate`,
        so an interrupted animation can work out where it had got to.
*/
const splineEasing = (easing) => {
    let spline = easing.spline;
    if (!spline) {
        const pieces = [];
        const addPiece = (x0, y0, x1, y1) => {
            const length = x1 - x0;
            const rise = y1 - y0;
            // Slopes in the piece's own coordinates, where it runs 0 to 1.
            const s0 = (slopeAt(easing, x0) * length) / rise;
            const s1 = (slopeAt(easing, x1) * length) / rise;
            const isFlat = Math.abs(rise) < 1e-6;
            const shape = isFlat ? identity : hermite(round(s0), round(s1));
            const errorAt = (u) =>
                Math.abs(y0 + rise * shape(u) - easing(x0 + length * u));
            if (
                length > SPLINE_MIN_LENGTH &&
                Math.max(errorAt(1 / 3), errorAt(2 / 3)) > SPLINE_TOLERANCE
            ) {
                const xm = (x0 + x1) / 2;
                const ym = round(easing(xm));
                addPiece(x0, y0, xm, ym);
                addPiece(xm, ym, x1, y1);
            } else {
                pieces.push({
                    offset: x0,
                    progress: y0,
                    shape,
                    easing: isFlat
                        ? 'linear'
                        : 'cubic-bezier(0.3333,' +
                          round(s0 / 3) +
                          ',0.6667,' +
                          round(1 - s1 / 3) +
                          ')',
                });
            }
        };
        const start = round(easing(0));
        const end = round(easing(1));
        addPiece(0, start, 1, end);
        pieces.push({ offset: 1, progress: end });
        spline = easing.spline = {
            pieces,
            evaluate: evaluateSpline(pieces),
        };
    }
    return spline;
};

const LINEAR_SAMPLES = 40;

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

/**
    Function (private): O.StyleAnimation.linearEasing

    Samples an easing function with no CSS form into a CSS `linear()` timing
    function, for keyframes that can't be split into a spline (see
    <canSplitFrame>). The browser interpolates between the two end values
    itself, so the curve is exact, but WebKit runs a `linear()` easing on
    the main thread.

    Parameters:
        easing - {Function} An easing function taking a value in [0..1] and
                 returning the progress at that point.

    Returns:
        {Object} The CSS easing as `cssName`, and the curve the browser
        actually runs as `evaluate`.
*/
const linearEasing = (easing) => {
    let linear = easing.linear;
    if (!linear) {
        const samples = [];
        for (let i = 0; i <= LINEAR_SAMPLES; i += 1) {
            samples.push(round(easing(i / LINEAR_SAMPLES)));
        }
        linear = easing.linear = {
            cssName: 'linear(' + samples.join(', ') + ')',
            evaluate: piecewiseLinear(samples),
        };
    }
    return linear;
};

// Plays the first keyframe for `hold` ms before the rest, by remapping the
// offsets into a longer duration. An easing for the whole effect moves to
// the first real keyframe so it still spans just the motion.
const withStartHold = (keyframes, options, hold) => {
    const { duration, easing } = options;
    const total = duration + hold;
    const last = keyframes.length - 1;
    const moving = keyframes.map((keyframe, index) => ({
        ...keyframe,
        offset: round(
            (hold + (keyframe.offset ?? index / last) * duration) / total,
        ),
    }));
    if (easing) {
        moving[0].easing = easing;
    }
    return {
        keyframes: [
            { ...keyframes[0], offset: 0, easing: 'linear' },
            ...moving,
        ],
        options: { duration: total },
    };
};

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

// A zero is the same length in any unit, so takes the other value's.
const unitOf = (property, from, to) => {
    for (const value of parseFloat(from) === 0 ? [to, from] : [from, to]) {
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

const leadingUnitRe = /^[a-z%]*/i;

// Transforms that only translate, rotate or skew are at rest when every
// number in them is 0, which is how interpolateTransform treats 'none'.
const zeroIsIdentityRe = /^(?:\s*(?:translate|rotate|skew)\w*\([^)]*\))+\s*$/;

// Transforms the browser interpolates number by number when both ends have
// the same functions. Others (matrix, rotate3d, perspective) are decomposed
// and interpolated as a whole, following a different path.
const perNumberRe =
    /^(?:\s*(?:translate(?:[XYZ]|3d)?|scale(?:[XYZ]|3d)?|rotate[XYZ]?|skew[XY]?)\([^)]*\))+\s*$/;

// Does interpolate() give the same value part way through this frame as the
// browser would? Only then can it be played as spline keyframes.
const canSplitFrame = ({ property, from, to }) => {
    if (property !== 'transform') {
        return (
            parseFloat(from) === 0 ||
            parseFloat(to) === 0 ||
            unitOf(property, from, from) === unitOf(property, to, to)
        );
    }
    from = cssString(property, from);
    to = cssString(property, to);
    if (from === 'none' || to === 'none') {
        return zeroIsIdentityRe.test(from === 'none' ? to : from);
    }
    if (!perNumberRe.test(from)) {
        return false;
    }
    const start = splitTransform(from);
    const end = splitTransform(to);
    if (start.length !== end.length || start[0] !== end[0]) {
        return false;
    }
    // Each number's unit must match, though a bare 0 takes the other's.
    for (let i = 2; i < start.length; i += 2) {
        const startUnit = leadingUnitRe.exec(start[i])[0];
        const endUnit = leadingUnitRe.exec(end[i])[0];
        if (
            start[i].slice(startUnit.length) !== end[i].slice(endUnit.length) ||
            (startUnit !== endUnit &&
                !(startUnit === '' && start[i - 1] === 0) &&
                !(endUnit === '' && end[i - 1] === 0))
        ) {
            return false;
        }
    }
    return true;
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
        this._evaluate = null;
        this._hold = 0;
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
            const curve = this.ease;
            const hold = (this._hold = this.startHold);
            let options = { duration };
            let webKeyframes;
            if (curve.cssName || !keyframes.every(canSplitFrame)) {
                const start = {};
                const end = {};
                for (const frame of keyframes) {
                    const property = frame.property;
                    start[property] = cssString(property, frame.from);
                    end[property] = cssString(property, frame.to);
                }
                webKeyframes = [start, end];
                if (curve.cssName) {
                    options.easing = curve.cssName;
                    this._evaluate = curve;
                } else {
                    const linear = linearEasing(curve);
                    options.easing = linear.cssName;
                    this._evaluate = linear.evaluate;
                }
            } else {
                const { pieces, evaluate } = splineEasing(curve);
                const last = pieces.length - 1;
                webKeyframes = pieces.map((piece, index) => {
                    const keyframe = { offset: piece.offset };
                    if (piece.easing) {
                        keyframe.easing = piece.easing;
                    }
                    for (const frame of keyframes) {
                        const property = frame.property;
                        keyframe[property] = cssString(
                            property,
                            index === 0
                                ? frame.from
                                : index === last
                                  ? frame.to
                                  : interpolate(
                                        property,
                                        frame.from,
                                        frame.to,
                                        piece.progress,
                                    ),
                        );
                    }
                    return keyframe;
                });
                this._evaluate = evaluate;
            }
            if (hold) {
                ({ keyframes: webKeyframes, options } = withStartHold(
                    webKeyframes,
                    options,
                    hold,
                ));
            }
            try {
                const animation = element.animate(webKeyframes, options);
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
            const time = (Number(animation.currentTime) || 0) - this._hold;
            position = this._evaluate(limit(time / duration, 0, 1));
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
        this._evaluate = null;
        this._hold = 0;
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

    The easing function to use for the animation. Cubic beziers from
    <O.Easing> are passed to the browser exactly; any other function is
    fitted with keyframes (see <splineEasing>), or sampled into a CSS
    `linear()` easing if the values can't be split (see <linearEasing>).
*/
StyleAnimation.prototype.ease = ease;

/**
    Property: O.StyleAnimation#startHold
    Type: Number
    Default: 40 on iOS, otherwise 0

    How long, in milliseconds, to hold the first keyframe before the motion
    starts. WebKit starts an animation's clock at the beginning of the frame
    that creates it, but on iOS that frame reaches the screen 40-50ms later,
    so without a hold the first frame seen is already a third of the way
    through a screen transition. A delay or a future start time doesn't
    help, as WebKit only hands the animation to the compositor once it has
    started; a hold inside the keyframes is handed over at once, and spends
    that latency standing still. 40ms covers most of it on a screen push,
    leaving the first frame about as far in as a native UIKit animation's.
    The hold lengthens the animation, so it finishes this much later.
*/
StyleAnimation.prototype.startHold = isIOS ? 40 : 0;

/**
    Function: O.StyleAnimation.playedDuration

    How long an animation of the given duration takes from when it starts to
    when it finishes, including the <O.StyleAnimation#startHold>. Time any
    work that must wait for an animation to end by this.

    Parameters:
        duration - {Number} The animation's duration, in ms.

    Returns:
        {Number} The time until it finishes, in ms.
*/
const playedDuration = (duration) =>
    duration ? duration + StyleAnimation.prototype.startHold : 0;

export { StyleAnimation, splineEasing, playedDuration };
