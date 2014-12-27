// -------------------------------------------------------------------------- \\
// File: Function.js                                                          \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*jshint strict: false */

/**
    Method: Function#bind

    ECMAScript 5 bind method. Returns a function which will call the
    original function bound to the given scope.

    Parameters:
        scope    - {Object} The object to bind the 'this' parameter to.
        var_args - {...*} Any further arguments will be supplied as
                   arguments to the original function when it is called,
                   followed by any other arguments given at the time of
                   calling.

    Returns:
        {Function} The bound function.
*/
Function.prototype.bind = function ( that ) {
    var fn = this,
        boundArgs = Array.prototype.slice.call( arguments, 1 );
    return function () {
        var args = boundArgs.slice();
        if ( arguments.length ) {
            Array.prototype.push.apply( args, arguments );
        }
        return fn.apply( that, args );
    };
};
