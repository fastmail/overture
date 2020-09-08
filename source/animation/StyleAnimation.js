import Animation from './Animation';
import { clone } from '../core/Core';
import { setStyle } from '../dom/Element';

const numbersRe = /[.\-\d]+/g;

const splitTransform = function (transform) {
    const result = [];
    const l = transform.length;
    let last = 0;
    let inFn = false;
    let inNumber = false;
    let i, character, part;

    for (i = 0; i < l; i += 1) {
        character = transform.charAt(i);
        if ((inNumber || inFn) && inNumber !== /^[.\-\d]/.test(character)) {
            part = transform.slice(last, i);
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

const zeroTransform = function (parts) {
    parts = parts.slice();
    for (let i = 1, l = parts.length; i < l; i += 2) {
        parts[i] = 0;
    }
    return parts;
};

const styleAnimators = {
    display: {
        calcDelta(startValue, endValue) {
            return endValue === 'none' ? startValue : endValue;
        },
        calcValue(position, deltaValue, startValue) {
            return position ? deltaValue : startValue;
        },
    },
    transform: {
        calcDelta(startValue, endValue) {
            let start = splitTransform(startValue || '');
            let end = splitTransform(endValue || '');
            let i, l;
            if (!endValue || endValue === 'none') {
                end = zeroTransform(start);
            }
            if (!startValue || startValue === 'none') {
                start = zeroTransform(end);
            }
            if (start.length !== end.length) {
                start = [startValue];
                end = [endValue];
            }
            for (i = 0, l = start.length; i < l; i += 1) {
                if (start[i] === 0 && /^[,)]/.test(start[i + 1])) {
                    start[i + 1] =
                        end[i + 1].replace(/[,)].*/g, '') + start[i + 1];
                }
            }
            return {
                start,
                delta: end.map((value, index) =>
                    index & 1 ? value - start[index] : 0,
                ),
            };
        },
        calcValue(position, deltaValue, _, end) {
            if (!deltaValue) {
                return end;
            }
            const start = deltaValue.start;
            const delta = deltaValue.delta;
            let transform = start[0];
            for (let i = 1, l = start.length; i < l; i += 2) {
                transform += start[i] + position * delta[i];
                transform += start[i + 1];
            }
            return transform;
        },
    },
};

const supported = {
    display: 1,

    top: 1,
    right: 1,
    bottom: 1,
    left: 1,

    marginTop: 1,
    marginRight: 1,
    marginBottom: 1,
    marginLeft: 1,

    paddingTop: 1,
    paddingRight: 1,
    paddingBottom: 1,
    paddingLeft: 1,

    width: 1,
    height: 1,

    transform: 1,

    opacity: 1,
};

/**
    Class: O.StyleAnimation

    Extends: O.Animation

    Animates the CSS styles of an element without using CSS transitions. This is
    used in browsers that don't support CSS transitions, but could also be
    useful if you want to animate an element using an easing method not
    supported by CSS transitions.

    Note, only the following CSS properties are currently supported by this
    class (all others will be set immediately without transition):

    * top
    * right
    * bottom
    * left
    * width
    * height
    * transform
    * opacity
*/
class StyleAnimation extends Animation {
    /**
        Method (protected): O.StyleAnimation#prepare

        Goes through the new styles for the element, works out which of these
        can be animated, and caches the delta value (difference between end and
        start value) for each one to save duplicated calculation when drawing a
        frame.

        Parameters:
            styles - {Object} A map of style name to desired value.

        Returns:
            {Boolean} True if any of the styles are going to be animated.
    */
    prepare(styles) {
        let animated = (this.animated = []);
        const from = (this.startValue = this.current);
        const current = (this.current = clone(from));
        const delta = (this.deltaValue = {});
        const units = (this.units = {});
        const element = this.element;

        this.endValue = styles;

        for (const property in styles) {
            let start = from[property];
            const end = styles[property];
            if (start !== end) {
                // We only support animating key layout properties.
                if (supported[property]) {
                    animated.push(property);
                    const animator = styleAnimators[property];
                    if (animator) {
                        delta[property] = animator.calcDelta(start, end);
                    } else {
                        units[property] =
                            (typeof start === 'string' &&
                                start.replace(numbersRe, '')) ||
                            (typeof end === 'string' &&
                                end.replace(numbersRe, '')) ||
                            // If no unit specified, using 0 will ensure
                            // the value passed to setStyle is a number, so
                            // it will add 'px' if appropriate.
                            0;
                        start = from[property] = parseFloat(start);
                        delta[property] = parseFloat(end) - start;
                    }
                } else {
                    current[property] = end;
                    setStyle(element, property, end);
                }
            }
        }

        // Animate common top change as a transform for performance
        if (delta.top && (!units.top || units.top === 'px')) {
            let transform = styles.transform || '';
            if (transform === 'none') {
                transform = '';
            }
            if (
                transform === '' ||
                /^translate3d\([^,]+,|\d+(?:px)?,0\)$/.test(transform)
            ) {
                if (!delta.transform) {
                    animated.push('transform');
                }
                if (transform === '') {
                    styles.transform = 'none';
                    transform = 'translate3d(0,' + delta.top + 'px,0)';
                } else {
                    const parts = transform.split(',');
                    parts[1] = parseInt(parts[1], 10) + delta.top + 'px';
                    transform = parts.join(',');
                }
                delta.tt = styleAnimators.transform.calcDelta(
                    from.transform || '',
                    transform,
                );
                animated.push('tt');
                animated = animated.filter((x) => x !== 'top' && x !== 'tt');
            }
        }

        if (animated.length) {
            setStyle(element, 'will-change', animated.join(', '));
            return true;
        }

        return false;
    }

    /**
        Method (protected): O.StyleAnimation#drawFrame

        Updates the animating styles on the element to the interpolated values
        at the position given.

        Parameters:
            position - {Number} The position in the animation.
    */
    drawFrame(position) {
        const isRunning = position < 1;
        const {
            startValue,
            endValue,
            deltaValue,
            units,
            current,
            animated,
            element,
        } = this;
        let l = animated.length;

        while (l--) {
            let property = animated[l];
            const delta = deltaValue[property];
            const isTopTransform = property === 'tt';
            if (isTopTransform) {
                property = 'transform';
            }

            const start = startValue[property];
            const end = endValue[property];
            const unit = units[property];
            const animator = styleAnimators[property];
            const value = isRunning
                ? animator
                    ? animator.calcValue(position, delta, start, end)
                    : start + position * delta + unit
                : end;

            if (isTopTransform) {
                if (!isRunning) {
                    continue;
                }
            } else {
                current[property] = value;
                if (
                    isRunning &&
                    deltaValue.tt &&
                    (property === 'top' || property === 'transform')
                ) {
                    continue;
                }
            }
            setStyle(element, property, value);
        }
    }

    stop() {
        if (this.isRunning) {
            const element = this.element;
            if (this.deltaValue.tt) {
                const current = this.current;
                setStyle(element, 'top', current.top);
                setStyle(element, 'transform', current.transform);
            }
            setStyle(element, 'will-change', 'auto');
        }
        return super.stop();
    }
}

export default StyleAnimation;
