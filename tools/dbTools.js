/*global require, process, console */

"use strict";

var fs = require( 'fs' );

function convert( dbFile, dbFile2 ) {
    fs.readFile( dbFile, 'utf8', function ( error, dbContents ) {
        if ( error ) {
            console.log( 'Could not read input db file' );
            return;
        }
        var data = {},
            attr = /^([A-Z0-9_]+)\.(caption|description|scope)="(.+)"/gm,
            match, entry;

        while ( match = attr.exec( dbContents ) ) {
            entry = data[ match[1] ] || ( data[ match[1] ] = {} );
            entry[ match[2] ] = match[3];
        }

        var keys = Object.keys( data ),
            i = 0,
            l = keys.length,
            output = '',
            id;

        for ( ; i < l; i += 1 ) {
            id = keys[i];
            entry = data[ id ];
            if ( /momail/.test( entry.scope ) ) {
                output += id + '\n';
                output += JSON.stringify( entry.caption ) + '\n';
                output += '[' + entry.description + ']\n\n';
            }
        }

        fs.writeFileSync( dbFile2, output );
    });
}

function sort( dbFile ) {
    fs.readFile( dbFile, 'utf8', function ( error, dbContents ) {
        if ( error ) {
            console.log( 'Could not read db ' );
            return;
        }
        var data = {},
            attr = /^([A-Z0-9_]+)\.(caption|description|scope)=(".+")/gm,
            match, entry;

        while ( match = attr.exec( dbContents ) ) {
            entry = data[ match[1] ] || ( data[ match[1] ] = {} );
            entry[ match[2] ] = match[3];
        }

        var keys = Object.keys( data ),
            i = 0,
            l = keys.length,
            output = '',
            id;
        keys.sort();

        for ( ; i < l; i += 1 ) {
            id = keys[i];
            entry = data[ id ];
            output += id + '=-1\n';
            output += id + '.caption=' + entry.caption + '\n';
            output += id + '.scope=' + entry.scope + '\n';
            output +=
                id + '.description=' + ( entry.description || '""' ) + '\n\n';
        }

        fs.writeFileSync( dbFile, output );
    });
}

function filter ( dbFile ) {
    fs.readFile( dbFile, 'utf8', function ( error, dbContents ) {
        if ( error ) {
            console.log( 'Could not read db ' );
            return;
        }
        var lines = dbContents.split( '\n' ),
            output = [],
            curTitle = null,
            buffer = [],
            processBuffer = function () {
                var block = buffer.join( '\n' ) + '\n';
                if ( block.indexOf( 'momail' ) > -1 ) {
                    output.push( block );
                }
                buffer = [];
            };

        lines.forEach( function ( line ) {
            var title = /^[A-Z0-9_]+/.exec( line );
            if ( !title ) {
                processBuffer();
                output.push( line );
            } else {
                title = title[0];
                if ( title !== curTitle ) {
                    processBuffer();
                    curTitle = title;
                }
                buffer.push( line );
            }
        });

        fs.writeFileSync( dbFile, output.join( '\n' ) );
    });
}

function compare ( dbFile, dbFile2 ) {
    fs.readFile( dbFile, 'utf8', function ( error, dbContents ) {
        if ( error ) {
            console.log( 'Could not read ' + dbFile );
            return;
        }
        fs.readFile( dbFile2, 'utf8', function ( error, db2Contents ) {
            if ( error ) {
                console.log( 'Could not read ' + dbFile2 );
                return;
            }
            var ids = {},
                ids2 = {},
                idRegExp = /^[A-Z0-9_]+/gm,
                id;

            while ( id = idRegExp.exec( dbContents ) ) {
                ids[ id[0] ] = true;
            }
            idRegExp.lastIndex = 0;
            while ( id = idRegExp.exec( db2Contents ) ) {
                ids2[ id[0] ] = true;
            }
            for ( id in ids ) {
                if ( ids2[ id ] ) {
                    delete ids[ id ];
                    delete ids2[ id ];
                }
            }
            console.log( 'In ' + dbFile + ' only: ' +
                JSON.stringify( Object.keys( ids ) ) );
            console.log( 'In ' + dbFile2 + ' only: ' +
                JSON.stringify( Object.keys( ids2 ) ) );
        });
    });
}

function dbToPo ( dbFile, poFile ) {
    fs.readFile( dbFile, 'utf8', function ( error, data ) {
        if ( error ) {
            console.log( 'Could not read language data file: ' + dbFile );
            return;
        }
        var poData = {},
            caption = /^([A-Z0-9_]+)\.caption="(.*?)"\n/gm,
            description = /^([A-Z0-9_]+)\.description="(.*?)"\n/gm,
            result, stringData;

        while ( result = caption.exec( data ) ) {
            stringData = poData[ result[1] ] || ( poData[ result[1] ] = {} );
            stringData.original = result[2];
        }

        while ( result = description.exec( data ) ) {
            stringData = poData[ result[1] ] || ( poData[ result[1] ] = {} );
            stringData.description = result[2];
        }

        var poString = '#. Two letter language code\n' +
            'msgid "<LanguageCode>"\n' +
            'msgstr "en-US"\n\n',
            start, end, id;
        for ( id in poData ) {
            stringData = poData[ id ];
            if ( description = stringData.description ) {
                start = 0;
                while ( true ) {
                    end = start + 70;
                    if ( end > description.length ) {
                        poString += '#. ';
                        poString +=
                            description.slice( start, description.length );
                        poString += '\n';
                        break;
                    } else {
                        end = description.lastIndexOf( ' ', end ) + 1;
                        if ( start === end ) {
                            end = start + 80;
                        }
                        poString += '#. ';
                        poString += description.slice( start, end );
                        poString += '\n';
                        start = end;
                    }
                }
            }
            poString += 'msgctxt ' + JSON.stringify( id ) + '\n';
            if ( stringData.original ) {
                poString +=
                    'msgid ' + JSON.stringify( stringData.original ) + '\n';
                poString +=
                    'msgstr ' + JSON.stringify( stringData.original ) + '\n';
            }
            poString += '\n';
        }

        fs.writeFileSync( poFile, poString );
    });
}


// Usage: node dbTools.js filter english.db
( function () {
    var action = process.argv[2],
        dbFile = process.argv[3],
        dbFile2 = process.argv[4];
    switch ( action ) {
        case 'convert':
            convert( dbFile, dbFile2 );
            break;
        case 'sort':
            sort( dbFile );
            break;
        case 'filter':
            filter( dbFile );
            break;
        case 'compare':
            compare( dbFile, dbFile2 );
            break;
        case 'dbToPo':
            dbToPo( dbFile, dbFile2 );
            break;
    }
}() );
