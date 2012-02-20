/*global require, process */

"use strict";

var fs = require( 'fs' );
var exec = require( 'child_process' ).exec;

function manifest( filenames ) {
    var outname = filenames.pop();
    var output = 'CACHE MANIFEST\nNETWORK:\n*\nCACHE:\n';
    var toProcess = filenames.length;
    filenames.forEach( function ( name, i ) {
        if ( name.indexOf( '-raw' ) !== -1 ) {
            // Find compressed name
            var folder = name.slice( 0, name.lastIndexOf( '/' ) );
            exec( 'find build -regex ' + name.slice( 0, -6 ) + '.*[0-9a-f]\\.js',
                    function ( error, stdout, stderr ) {
                // Replace 'build/ajaxui/' with '../, remove trailing \n
                filenames[i] = '../' + stdout.slice( 13, -1 );
                if ( ( toProcess -= 1 ) === 0 ) {
                    fs.writeFile( outname, output + filenames.join( '\n' ) );
                }
            });
        } else {
            // Replace 'build/ajaxui/' with '../
            filenames[i] = '../' + name.slice( 13 );
            if ( ( toProcess -= 1 ) === 0 ) {
                fs.writeFile( outname, output + filenames.join( '\n' ) );
            }
        }
    });
}

( function () {
    var args = process.argv.slice( 2 );
    return manifest( args );
}() );
