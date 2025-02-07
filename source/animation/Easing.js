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
        given, with an equivalent CSS representation on the function's cssName
        property.
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
        // Ends of the curve. Avoids divide by 0 issues with newton-raphson
        // method.
        if (x === 0 || x === 1) {
            return x;
        }
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

    linear#cssName is a property which represents an equivalent CSS
    representation for the method.

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

/**
    Function: O.Easing#bouncelessSpring

    Creates a critically damped spring system (i.e. no bounce). A CSS
    representation is not available, see: 
    https://github.com/w3c/csswg-drafts/issues/280

    To make choosing parameters easier, the output of the system can be viewed
    and modified here:
    https://www.desmos.com/calculator/5vrrmsijq4

    Parameters:
        args - {Object} (optional) An object to configure the spring's initial
               conditions. Accepted properties are:
                        
               - mass: {Number} The weight of the object to displace. Larger
                 values round and reduce the steepness of the curve. Usually
                 represented as `m` formally.
               - stiffness: {Number} How rigid the spring is. A greater value
                 makes the spring more resistent to kickback as velocity
                 increases and steepens the output curve. Usually represented as
                 `k` formally.
               - velocity: {Number} The initial velocity of the system. Greater
                 values can result in kickback where the animation overshoots
                 the target before settling. Usually represented as `v_0`
                 formally.
               - offset: {Number} The initial offset of the system. This shifts
                 the y-intercept of the growth rate. Useful when wanting to map
                 smaller values of x to larger output values.
    Returns:
        {Function} A function representing the spring system created by the
        inputs given.
 */
const bouncelessSpring = ({
    mass = 1,
    stiffness = 100,
    velocity = 0,
    offset = 0,
} = {}) => {
    const undampedAngularFrequency = Math.sqrt(stiffness / mass); // omega_0
    const A = 1 + offset;
    const B = -velocity + undampedAngularFrequency;
    const output = (x) => {
        const growth = A + B * x;
        const decay = Math.exp(-x * undampedAngularFrequency);
        const t = growth * decay;
        return 1 - t; // [1..0] -> [0..1]
    };
    return output;
};
bouncelessSpring.cssName = null;

export {
    cubicBezier,
    ease,
    easeIn,
    easeOut,
    easeInOut,
    linear,
    bouncelessSpring,
};
