// -------------------------------------------------------------------------- \\
// File: Easing.js                                                            \\
// Module: Animation                                                          \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2012 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var cubicBezier = function ( p1x, p1y, p2x, p2y ) {
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
        cssName: 'cubic-bezier(' + p1x + ',' + p1y + ',' + p2x + ',' + p2y + ')'
    });
};


NS.Easing = {
    linear: function ( n ) {
        return n;
    }.extend({ cssName: 'linear' }),

    ease: cubicBezier( 0.25, 0.1, 0.25, 1 ),
    easeIn: cubicBezier( 0.42, 0, 1, 1 ),
    easeOut: cubicBezier( 0, 0, 0.58, 1 ),
    easeInOut: cubicBezier( 0.42, 0, 0.58, 1 )
};

}( this.O ) );
