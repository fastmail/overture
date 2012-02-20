// -------------------------------------------------------------------------- \\
// File: RegExp.js                                                            \\
// Module: IEPatches                                                          \\
// Author: Steven Levithan, Neil Jenkins                                      \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

( function ( undefined ) {

// Fix major issues in IE split() function
// Main bug is the failure to include capture groups in the output (needed for
// spell check).
// Fix by Steven Levithan:
// http://blog.stevenlevithan.com/archives/cross-browser-split
if ('a~b'.split(/(~)/).length !== 3) {
    
	String.prototype._$$split =
	    String.prototype._$$split || String.prototype.split;

	String.prototype.split = function ( s /* separator */, limit ) {
		// if separator is not a regex, use the native split method
		if ( !( s instanceof RegExp ) ) {
			return String.prototype._$$split.apply(this, arguments);
		}

		var	flags = ( s.global ? "g" : "" ) + ( s.ignoreCase ? "i" : "" ) +
		        ( s.multiline ? "m" : "" ),
			s2 = new RegExp( "^" + s.source + "$", flags ),
			output = [],
			origLastIndex = s.lastIndex,
			lastLastIndex = 0,
			i = 0, match, lastLength;

		/* behavior for limit: if it's...
		- undefined: no limit
		- NaN or zero: return an empty array
		- a positive number: use limit after dropping any decimal
		- a negative number: no limit
		- other: type-convert, then use the above rules
		*/
		if ( limit === undefined || +limit < 0 ) {
			limit = false;
		} else {
			limit = Math.floor( +limit );
			if ( !limit ) {
				return [];
			}
		}

		if ( s.global ) {
			s.lastIndex = 0;
		}
		else {
			s = new RegExp( s.source, "g" + flags );
		}

		while ( ( !limit || i <= limit ) && ( match = s.exec( this ) ) ) {
			i += 1;
			var emptyMatch = !match[0].length;

			// Fix IE's infinite-loop-resistant but incorrect lastIndex
			if ( emptyMatch && s.lastIndex > match.index ) {
				s.lastIndex--;
			}

			if ( s.lastIndex > lastLastIndex ) {
				// Fix browsers whose exec methods don't consistently return
				// undefined for non-participating capturing groups
				if ( match.length > 1 ) {
					match[0].replace( s2, function () {
						for ( var j = 1; j < arguments.length - 2; j++ ) {
							if ( arguments[j] === undefined ) {
								match[j] = undefined;
							}
						}
					});
				}

				output = output.concat(
				    this.slice( lastLastIndex, match.index ) );
				if ( 1 < match.length && match.index < this.length ) {
					output = output.concat(match.slice(1));
				}
				
				// only needed if s.lastIndex === this.length
				lastLength = match[0].length;
				
				lastLastIndex = s.lastIndex;
			}

			if ( emptyMatch ) {
				s.lastIndex += 1; // avoid an infinite loop
			}
		}

		// Since this uses test(), output must be generated before
		// restoring lastIndex
		output = lastLastIndex === this.length ?
			( s.test( "" ) && !lastLength ? output : output.concat( "" ) ) :
			( limit ? output : output.concat( this.slice( lastLastIndex ) ) );
			
		// Only needed if s.global, else we're working with a copy of the regex
		s.lastIndex = origLastIndex;
		
		return output;
	};
}

}() );
