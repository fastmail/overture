/*global console, require, process */

"use strict";

var fs = require( 'fs' );

( function () {
    var input = process.argv[2],
        output = process.argv[3];

    fs.readFile( input, 'utf8', function ( error, data ) {
        if ( error ) {
            console.log( 'Could not read ' + input );
        } else {
            var index = JSON.parse( data ).pathToFile,
                searchIndex = [];

            for ( var item in index ) {
                searchIndex.push({
                    name: item,
                    path: index[ item ]
                });
            }

            fs.writeFile( output, 'var index = ' +
                JSON.stringify( searchIndex ) + ';' );
        }
    });
}() );
