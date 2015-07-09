// -------------------------------------------------------------------------- \\
// File: String.js                                                            \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*jshint strict: false */

/**
    Method: String#trim

    Returns the string with any white space at the beginning and end
    removed. Implementation by Steven Levithan:
    <http://blog.stevenlevithan.com/archives/faster-trim-javascript>

    Returns:
        {String} The trimmed string.
*/
String.prototype.trim = function () {
    var str = this.replace( /^\s\s*/, '' ),
        ws = /\s/,
        i = str.length;
    while ( ws.test( str.charAt( i -= 1 ) ) ) {/* Empty! */}
    return str.slice( 0, i + 1 );
};
