/**
    Object: O.Easing

    Holds functions emulating the standard CSS easing functions.
*/

/**
    Function: O.Easing.cubicBezier

    Returns an easing function that, for the given cubic bezier control
    points, returns the y position given an x position. p0 is presumed to
    be (0,0) and p3 is presumed to be (1,1).

    Parameters:
        p1x - {Number} The x-coordinate for point 1.
        p1y - {Number} The y-coordinate for point 1.
        p2x - {Number} The x-coordinate for point 2.
        p2y - {Number} The y-coordinate for point 2.

    Returns:
        {Function} A function representing the cubic bezier with the points
        given.
*/
const cubicBezier = function (p1x, p1y, p2x, p2y) {
    // Calculate constants in parametric bezier formular
    // http://www.moshplant.com/direct-or/bezier/math.html
    const cX = 3 * p1x;
    const bX = 3 * (p2x - p1x) - cX;
    const aX = 1 - cX - bX;

    const cY = 3 * p1y;
    const bY = 3 * (p2y - p1y) - cY;
    const aY = 1 - cY - bY;

    // Functions for calculating x, x', y for t
    const bezierX = (t) => t * (cX + t * (bX + t * aX));
    const bezierXDerivative = (t) => cX + t * (2 * bX + 3 * aX * t);

    // Use Newton-Raphson method to find t for a given x.
    // Since x = a*t^3 + b*t^2 + c*t, we find the root for
    // a*t^3 + b*t^2 + c*t - x = 0, and thus t.
    const newtonRaphson = (x) => {
        let prev;
        // Initial estimation is linear
        let t = x;
        do {
            prev = t;
            t = t - (bezierX(t) - x) / bezierXDerivative(t);
        } while (Math.abs(t - prev) > 1e-4);

        return t;
    };

    const output = (x) => {
        const t = newtonRaphson(x);
        // This is y given t on the bezier curve.
        return t * (cY + t * (bY + t * aY));
    };
    output.cssName =
        'cubic-bezier(' + p1x + ',' + p1y + ',' + p2x + ',' + p2y + ')';
    return output;
};

/**
    Function: O.Easing#ease

    Equivalent to the CSS ease transition, a cubic bezier curve with control
    points (0.25, 0.1) and (0.25, 1).

    Parameters:
        n - {Number} A number between 0 and 1 representing the current
            position in the animation.

    Returns:
        {Number} The position along the animation path (between 0 and 1).
*/
const ease = cubicBezier(0.25, 0.1, 0.25, 1);

/**
    Function: O.Easing#easeIn

    Equivalent to the CSS easeIn transition, a cubic bezier curve with
    control points (0.42, 0) and (1, 1).

    Parameters:
        n - {Number} A number between 0 and 1 representing the current
            position in the animation.

    Returns:
        {Number} The position along the animation path (between 0 and 1).
*/
const easeIn = cubicBezier(0.42, 0, 1, 1);

/**
    Function: O.Easing#easeOut

    Equivalent to the CSS easeOut transition, a cubic bezier curve with
    control points (0, 0) and (0.58, 1).

    Parameters:
        n - {Number} A number between 0 and 1 representing the current
            position in the animation.

    Returns:
        {Number} The position along the animation path (between 0 and 1).
*/
const easeOut = cubicBezier(0, 0, 0.58, 1);

/**
    Function: O.Easing#easeInOut

    Equivalent to the CSS easeInOut transition, a cubic bezier curve with
    control points (0.42, 0) and (0.58, 1).

    Parameters:
        n - {Number} A number between 0 and 1 representing the current
            position in the animation.

    Returns:
        {Number} The position along the animation path (between 0 and 1).
*/
const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

/**
    Function: O.Easing#linear

    Linear easing.

    Parameters:
        n - {Number} A number between 0 and 1 representing the current
            position in the animation.

    Returns:
        {Number} The position along the animation path (between 0 and 1).
*/
const linear = function (n) {
    return n;
};
linear.cssName = 'linear';

export { cubicBezier, ease, easeIn, easeOut, easeInOut, linear };
