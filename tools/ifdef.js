/*global require, process, console */

"use strict";

var fs = require( 'fs' );

( function () {
    var args = process.argv.slice( 2 );
    var defs = args[0].split( ',' ).reduce( function ( defs, name ) {
        defs[ name.toUpperCase() ] = true;
        return defs;
    }, {} );
    var input = args[1];
    var output = args[2];

    fs.readFile( input, 'utf8', function ( error, data ) {
        if ( !error ) {
            var stack = [];
            var length = 0;
            var lines = data.split( '\n' ).filter( function ( line ) {
                var parts = /^\s*\/\/ #(if(?:not)?|end)\s?(\w+)?/.exec( line ),
                    include = !length || stack[ length - 1 ];
                if ( parts ) {
                    switch ( parts[1] ) {
                        case 'end':
                            stack.pop();
                            length -= 1;
                            break;
                        case 'if':
                            stack.push( include && !!defs[ parts[2] ] );
                            length += 1;
                            break;
                        case 'ifnot':
                            stack.push( include && !defs[ parts[2] ] );
                            length += 1;
                            break;
                    }
                    return false;
                }
                return include;
            });
            fs.writeFile( output,
                lines.join( '\n' )
                     .replace( /\n{3,}/g, '\n\n' )
                     .replace( /\n\s*,\s*\n/g, ',\n' )
            );
        }
    });
}() );
