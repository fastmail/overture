/*global require, process, console */

"use strict";

var fs = require( 'fs' );
var less = require( 'less' );
var ug = require( 'uglify-js' );

var compressJS = function ( code, output ) {
    var ast = ug.parser.parse( code );
    ast = ug.uglify.ast_mangle( ast );
    ast = ug.uglify.ast_squeeze( ast );
    return ug.uglify.gen_code( ast );
};

var concatenate = function ( inputs, output, minify ) {
    var data = '',
        strict = false;
    inputs.forEach( function ( input ) {
        data += fs.readFileSync( input, 'utf8' );
    });
    data = data.replace( /"use strict"[;,]\n?/g, function () {
        strict = true;
        return '';
    });
    if ( minify ) { data = compressJS( data ); }
    if ( strict ) { data = '"use strict";\n' + data; }
    fs.writeFile( output, data );
};

( function () {
    var args = process.argv.slice( 2 );
    switch ( args[0] ) {
        case 'concatenate':
            concatenate( args.slice( 1, -1 ), args[ args.length - 1 ], false );
            break;
        case 'compress':
            concatenate( args.slice( 1, -1 ), args[ args.length - 1 ], true );
            break;
    }
}() );