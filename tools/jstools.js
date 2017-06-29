/*global require, process, console */

"use strict";

var fs = require( 'fs' );

var concatenate = function ( inputs, output ) {
    var data = '',
        strict = false;
    inputs.forEach( function ( input ) {
        data += fs.readFileSync( input, 'utf8' );
    });
    data = data.replace( /^\s*"use strict"[;,]\n?/gm, function () {
        strict = true;
        return '';
    });
    if ( strict ) { data = '"use strict";\n' + data; }
    fs.writeFileSync( output, data );
};

( function () {
    var args = process.argv.slice( 2 );
    switch ( args[0] ) {
        case 'concatenate':
            concatenate( args.slice( 1, -1 ), args[ args.length - 1 ] );
            break;
    }
}() );
