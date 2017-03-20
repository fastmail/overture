import { Class } from '../core/Core.js';

const Parse = Class({
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
        const string = parse.string;
        const result = regexp.exec( string );
        if ( result ) {
            const part = result[0];
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
        const newParse = parse.clone();
        return !pattern( newParse );
    };
};

Parse.repeat = function ( pattern, min, max ) {
    // Max int: 2^31 - 1;
    if ( !max ) { max = 2147483647; }
    return function ( parse ) {
        const newParse = parse.clone();
        let i = 0;
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
        const newParse = parse.clone();
        for ( let i = 0, l = patterns.length; i < l; i += 1 ) {
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
        for ( let i = 0, l = patterns.length; i < l; i += 1 ) {
            if ( patterns[i]( parse ) ) {
                return true;
            }
        }
        return false;
    };
};

Parse.longestMatch = function ( patterns ) {
    return function ( parse ) {
        const parses = [];
        let l = patterns.length;
        for ( let i = 0; i < l; i += 1 ) {
            const newParse = parse.clone();
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
            let newParse = parses[l];
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
