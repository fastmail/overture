/*global console, require, process */

"use strict";

var fs = require( 'fs' );

var makeIndex = function ( data, index, file ) {
    var moduleName = data.header.Module,
        module = index.modules[ moduleName ];
    if ( !module ) {
        module = index.modules[ moduleName ] = {
            files: [],
            description: ''
        };
    }
    module.files.push({
        name: data.header.File,
        docs: file
    });

    data.blocks.forEach( function ( block ) {
        if ( block.type === 'Module' ) {
            module.description = block.Description;
        } else {
            index.pathToFile[ block.path ] = file;
            index.pathToType[ block.path ] = block.type;
        }
    });
};

// Usage: node makeIndex.js input.json input2.json ... output
( function () {
    var input = process.argv.slice( 2 ),
        output = input.pop(),
        toProcess = input.length,
        index = {
            modules: {},
            pathToFile: {},
            pathToType: {},
        };

    input.forEach( function ( file ) {
        fs.readFile( file, 'utf8', function ( error, data ) {
            if ( error ) {
                console.log( 'Could not read ' + input );
            } else {
                makeIndex(
                    JSON.parse( data ),
                    index,
                    file.replace( 'docs/_parse/', '' ).slice( 0, -4 ) + 'html'
                );
                toProcess -= 1;
                if ( !toProcess ) {
                    fs.writeFile( output, JSON.stringify( index, null, 4 ) );
                }
            }
        });
    });
}() );
