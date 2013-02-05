// -------------------------------------------------------------------------- \\
// File: RegExp.js                                                            \\
// Module: IEPatches                                                          \\
// Author: Steven Levithan, Neil Jenkins                                      \\
// License: © 2010–2013 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*jshint strict: false */

( function ( undefined ) {

// Fix major issues in IE split() function
// Main bug is the failure to include capture groups in the output.
// Original fix by Steven Levithan (tidied and optimised by Neil Jenkins):
// http://blog.stevenlevithan.com/archives/cross-browser-split
if ('a~b'.split(/(~)/).length !== 3) {
    var nativeSplit = String.prototype.split;
    String.prototype.split = function ( separator, limit ) {
        // If separator is not a regex, use the native split method
        if ( !( separator instanceof RegExp ) ) {
            return nativeSplit.apply( this, arguments );
        }

        var flags = ( separator.global ? 'g' : '' ) +
                    ( separator.ignoreCase ? 'i' : '' ) +
                    ( separator.multiline ? 'm' : '' ),
            separator2 = new RegExp( '^' + separator.source + '$', flags ),
            output = [],
            origLastIndex = separator.lastIndex,
            lastLastIndex = 0,
            i, match, lastLength, emptyMatch;

        /* behavior for limit: if it's...
        - undefined: no limit
        - NaN or zero: return an empty array
        - a positive number: use limit after dropping any decimal
        - a negative number: no limit
        - other: type-convert, then use the above rules
        */
        if ( limit === undefined || +limit < 0 ) {
            limit = 0;
        } else {
            limit = Math.floor( +limit );
            if ( !limit ) {
                return output;
            }
        }

        if ( separator.global ) {
            separator.lastIndex = 0;
        }
        else {
            separator = new RegExp( separator.source, 'g' + flags );
        }

        for ( i = 0;
                ( !limit || i <= limit ) && ( match = separator.exec( this ) );
                i += 1 ) {
            emptyMatch = !match[0].length;

            // Fix IE's infinite-loop-resistant but incorrect lastIndex
            if ( emptyMatch && separator.lastIndex > match.index ) {
                separator.lastIndex -= 1;
            }

            if ( separator.lastIndex > lastLastIndex ) {
                // Fix browsers whose exec methods don't consistently return
                // undefined for non-participating capturing groups
                if ( match.length > 1 ) {
                    match[0].replace( separator2, function () {
                        for ( var j = 1; j < arguments.length - 2; j += 1 ) {
                            if ( arguments[j] === undefined ) {
                                match[j] = undefined;
                            }
                        }
                    });
                }
                output.push( this.slice( lastLastIndex, match.index ) );
                if ( match.length > 1 && match.index < this.length ) {
                    output.push( match.slice( 1 ) );
                }
                // only needed if s.lastIndex === this.length
                lastLength = match[0].length;
                lastLastIndex = separator.lastIndex;
            }

            if ( emptyMatch ) {
                separator.lastIndex += 1; // avoid an infinite loop
            }
        }

        // Since this uses test(), output must be generated before
        // restoring lastIndex
        if ( lastLastIndex === this.length ) {
            if ( !separator.test( '' ) || lastLength ) {
                output.push( '' );
            }
        } else {
            if ( !limit ) {
                output.push( this.slice( lastLastIndex ) );
            }
        }

        // Only needed if s.global, else we're working with a copy of the regex
        separator.lastIndex = origLastIndex;

        return output;
    };
}

}() );
