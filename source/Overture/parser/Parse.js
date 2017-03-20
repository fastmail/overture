// -------------------------------------------------------------------------- \\
// File: Parse.js                                                             \\
// Module: Parser                                                             \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

import { Class } from '../core/Core.js';

var Parse = Class({
    init: function ( string, tokens ) {
        this.string = string;
        this.tokens = tokens || [];
    },
    clone: function () {
        return new Parse( this.string, this.tokens.slice() );
    },
    assimilate: function ( parse ) {
        this.string = parse.string;
        this.tokens = parse.tokens;
    },
});

Parse.define = function ( name, regexp, context ) {
    return function ( parse ) {
        var string = parse.string,
            result = regexp.exec( string ),
            part;
        if ( result ) {
            part = result[0];
            parse.tokens.push([ name, part, context || null ]);
            parse.string = string.slice( part.length );
        }
        return !!result;
    };
};

Parse.optional = function ( pattern ) {
    return function ( parse ) {
        pattern( parse );
        return true;
    };
};

Parse.not = function ( pattern ) {
    return function ( parse ) {
        var newParse = parse.clone();
        return !pattern( newParse );
    };
};

Parse.repeat = function ( pattern, min, max ) {
    // Max int: 2^31 - 1;
    if ( !max ) { max = 2147483647; }
    return function ( parse ) {
        var newParse = parse.clone(),
            i = 0;
        do {
            if ( pattern( newParse ) ) {
                i += 1;
            } else {
                break;
            }
        } while ( i < max );
        if ( i >= min ) {
            if ( i ) {
                parse.assimilate( newParse );
            }
            return true;
        }
        return false;
    };
};

Parse.sequence = function ( patterns ) {
    return function ( parse ) {
        var newParse = parse.clone();
        for ( var i = 0, l = patterns.length; i < l; i += 1 ) {
            if ( !patterns[i]( newParse ) ) {
                return false;
            }
        }
        // Successful: copy over results of parse
        parse.assimilate( newParse );
        return true;
    };
};

Parse.firstMatch = function ( patterns ) {
    return function ( parse ) {
        for ( var i = 0, l = patterns.length; i < l; i += 1 ) {
            if ( patterns[i]( parse ) ) {
                return true;
            }
        }
        return false;
    };
};

Parse.longestMatch = function ( patterns ) {
    return function ( parse ) {
        var parses = [],
            i, l, newParse;
        for ( i = 0, l = patterns.length; i < l; i += 1 ) {
            newParse = parse.clone();
            if ( patterns[i]( newParse ) ) {
                parses.push( newParse );
                // Have we found a perfect parse? If so, stop.
                if ( !newParse.string ) {
                    break;
                }
            }
        }
        // Find the parse with shortest string left over.
        l = parses.length;
        if ( l-- ) {
            newParse = parses[l];
            while ( l-- ) {
                if ( parses[l].string.length <= newParse.string.length ) {
                    newParse = parses[l];
                }
            }
            parse.assimilate( newParse );
            return true;
        }
        return false;
    };
};

export default Parse;
