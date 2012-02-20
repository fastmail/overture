// -------------------------------------------------------------------------- \\
// File: Number.js                                                            \\
// Module: Core                                                               \\
// Requires: Core.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

"use strict";

Number.implement({
    /*
        Method: Number#limit
        
        Limits the number to be within the given range.
        
        Parameters:
            min - {Number} The minimum allowed value.
            max - {Number} The maximum allowed value.

        Returns:
            {Number} The nearest number to the current value within the allowed
            range.
    */
    limit: function ( min, max ) {
        return this < min ? min : this > max ? max : this;
    },
    
    /*
        Method: Number#mod
        
        Returns the number mod n.
        
        Parameters:
            n - {Number}

        Returns:
            {Number} The number mod n.
    */
    mod: function ( n ) {
        var m = this % n;
        return m < 0 ? m + n : m;
    }
});