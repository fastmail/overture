// -------------------------------------------------------------------------- \\
// File: Date.js                                                              \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*jshint strict: false */

/**
    Function: Date.now

    ECMAScript 5 Date.now method. Returns the current time as the number of
    milliseconds since 1 January 1970.

    Returns:
        {Number} The current time.
*/
Date.now = function () {
    return +( new Date() );
};
