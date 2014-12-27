// -------------------------------------------------------------------------- \\
// File: Object.js                                                            \\
// Module: IEPatches                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

/*jshint strict: false */

/**
    Function: Object.create

    ECMAScript 5 create static method. Returns an object with the given
    object as its prototype. Note the ECMAScript 5 method actually also
    accepts further arguments but these are impossible to emulate.

    Parameters:
        proto - {Object} The object to use as prototype for the new object.

    Returns:
        {Object} The new object.
*/
Object.create = function ( proto ) {
    var F = function () {};
    F.prototype = proto;
    return new F();
};

/**
    Function: Object.keys

    ECMAScript 5 keys static method. Returns an array of keys for all
    enumerable properties defined explicitly on the object (not its
    prototype).

    Parameters:
        object - {Object} The object to get the array of keys from.

    Returns:
        {String[]} The list of keys.
*/
Object.keys = function ( object ) {
    var keys = [];
    for ( var key in object ) {
        if ( object.hasOwnProperty( key ) ) {
            keys.push( key );
        }
    }
    return keys;
};
