/*global console, require, process */

"use strict";

var fs = require( 'fs' );

var trim = function trim ( obj ) {
    if ( obj instanceof Array ) {
        return obj.map( trim );
    }
    switch ( typeof obj ) {
        case 'object':
            var old = obj,
                key;
            obj = {};
            for ( key in old ) {
                obj[ key ] = trim( old[ key ] );
            }
            break;
        case 'string':
            obj = obj.trim();
            break;
    }
    return obj;
};

var parseFile = function ( contents, path ) {
    // First few lines are because we dropped headers when migrating to ES6
    // modules, but still want this docbuilder to more or less work.
    if ( !path.startsWith( 'source/' ) ) {
        throw new Error( 'parseFile: needs path to start with source/ for now' );
    }
    var pathComponents = path.split( '/' );
    var module = pathComponents[ 1 ];
    var filename = pathComponents[ pathComponents.length - 1 ];
    var lines = contents.split( '\n' ),
        beginDocs = /^(\s*)\/\*\*$/,
        endDocs = /^(\s*)\*\/$/,
        type = /^([A-Z][a-z]+)(?: \((pr(?:ivate|otected))\))?:(.*)$/,
        title = /^([A-Z][a-z]+):/,
        headerDelimiter = /^\/\/ \-+ \\\\$/,
        i = 0,
        l = lines.length,
        indentation = 0,
        inDocs = false,
        inPart = false,
        inHeader = false,
        code = '',
        blocks = [],
        header = {
            Module: module,
            File: filename,
            pathToRoot: '../'.repeat( pathComponents.length - 2 ),
        },
        result, line, block, current, isDelimiterLine;

    for ( ; i < l; i += 1 ) {
        line = lines[ i ];
        isDelimiterLine = headerDelimiter.test( line );
        if ( isDelimiterLine ) {
            inHeader = !inHeader;
            continue;
        }
        if ( inHeader ) {
            // Slice of '//' from beginning and '\\' from end.
            line = line.slice( 2, -2 ).trim();
            result = title.exec( line );
            if ( result ) {
                header[ current = result[1] ] =
                    line.slice( result[0].length ).trim();
            } else {
                header[ current ] += ' ' + line;
            }
        }
        else if ( !inDocs ) {
            result = beginDocs.exec( line );
            if ( result ) {
                if ( block && block.type !== 'Module' ) {
                    block.code = code;
                    code = '';
                }
                inDocs = true;
                current = null;
                indentation = result[1].length + 4;
                blocks.push( block = {
                    docsLineNumber: i + 1,
                    docs: [],
                    code: '',
                    Description: ''
                });
            } else {
                code += line + '\n';
            }
        }
        else {
            result = endDocs.test( line );
            if ( result ) {
                inDocs = false;
                block.codeLineNumber = i + 2;
            } else {
                line = line.slice( indentation );
                // Parse block type and path
                if ( !block.type ) {
                    result = type.exec( line );
                    if ( !result ) {
                        console.log( 'No type specified! Line: ' + (i + 1) );
                    } else {
                        block.type = result[1];
                        block.access = result[2] || 'public';
                        block.path = result[3].trim();
                    }
                }
                // Parse normal section.
                else {
                    result = title.exec( line );
                    if ( result ) {
                        block[ current ] = block[ current ] &&
                            block[ current ].trim();
                        block[ current = result[1] ] =
                            line.slice( result[0].length );
                    }
                    else if ( /^\s*$/.test( line ) ) {
                        if ( current ) {
                            block[ current ] += '\n';
                        }
                    }
                    else if ( current !== 'Description' ) {
                        if ( line.slice( 0, 4 ) === '    ' ) {
                            block[ current ] = block[ current ] &&
                                block[ current ].trim();
                            block[ current ] +=
                                ( block[ current ] ? '\n' : '' ) +
                                line.slice( 4 );
                        } else {
                            block[ current = 'Description' ] = line;
                        }
                    } else {
                        block[ current ] += '\n' + line;
                    }
                }
            }
        }
    }
    if ( block ) {
        block.code = code;
    }

    return trim( { header: header, blocks: blocks } );
};

// Usage: node extract.js input output
( function () {
    var input = process.argv[2],
        output = process.argv[3];

    fs.readFile( input, 'utf8', function ( error, data ) {
        if ( error ) {
            console.log( 'Could not read ' + input );
        } else {
            fs.writeFileSync( output,
                JSON.stringify( parseFile( data, input ), null, 4 ) );
        }
    });
}() );
