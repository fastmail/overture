// -------------------------------------------------------------------------- \\
// File: Easing.js                                                            \\
// Module: Animation                                                          \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import '../core/Core.js';  // For Function#extend

var cubicBezier;

/**
    Object: O.Easing

    Holds functions emulating the standard CSS easing functions.
*/
export default {
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

    cubicBezier: cubicBezier = function ( p1x, p1y, p2x, p2y ) {
        // Calculate constants in parametric bezier formular
        // http://www.moshplant.com/direct-or/bezier/math.html
        var cX = 3 * p1x,
            bX = 3 * ( p2x - p1x ) - cX,
            aX = 1 - cX - bX,

            cY = 3 * p1y,
            bY = 3 * ( p2y - p1y ) - cY,
            aY = 1 - cY - bY;

        // Functions for calculating x, x', y for t
        var bezierX = function ( t ) {
            return t * ( cX + t * ( bX + t * aX ) );
        };
        var bezierXDerivative = function ( t ) {
            return cX + t * ( 2 * bX + 3 * aX * t );
        };

        // Use Newton-Raphson method to find t for a given x.
        // Since x = a*t^3 + b*t^2 + c*t, we find the root for
        // a*t^3 + b*t^2 + c*t - x = 0, and thus t.
        var newtonRaphson = function ( x ) {
            var prev,
                // Initial estimation is linear
                t = x;
            do {
                prev = t;
                t = t - ( ( bezierX( t ) - x ) / bezierXDerivative( t ) );
            } while ( Math.abs( t - prev ) > 1e-4 );

            return t;
        };

        return function ( x ) {
            var t = newtonRaphson( x );
            // This is y given t on the bezier curve.
            return t * ( cY + t * ( bY + t * aY ) );
        }.extend({
            cssName: 'cubic-bezier(' + p1x + ',' + p1y + ',' +
                p2x + ',' + p2y + ')'
        });
    },

    /**
        Function: O.Easing#linear

        Linear easing.

        Parameters:
            n - {Number} A number between 0 and 1 representing the current
                position in the animation.

        Returns:
            {Number} The position along the animation path (between 0 and 1).
    */
    linear: function ( n ) {
        return n;
    }.extend({ cssName: 'linear' }),

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
    ease: cubicBezier( 0.25, 0.1, 0.25, 1 ),

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
    easeIn: cubicBezier( 0.42, 0, 1, 1 ),

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
    easeOut: cubicBezier( 0, 0, 0.58, 1 ),

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
    easeInOut: cubicBezier( 0.42, 0, 0.58, 1 )
};
