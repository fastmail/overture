/*global require, process, console */

"use strict";

var fs = require( 'fs' );

var isId = /^[A-Z0-9_]+$/;

// DB Tools

var parseDB = function ( text ) {
    var lines = text.split( '\n' ),
        db = [],
        obj, id;
    
    lines.forEach( function ( line ) {
        line = line.trim();
        // ID
        if ( isId.test( line ) ) {
            id = line;
            obj = {
                id: id
            };
            db.push( obj );
        } else
        // String
        if ( /^".*"$/.test( line ) ) {
            if ( !id ) {
                console.log( "Error: Found a string before an id - " + line );
            } else {
                try {
                    obj.string = JSON.parse( line );
                } catch ( error ) {
                    console.log(
                        "Error: String is not properly escaped - " + line );
                }
            }
        } else
        // Description
        if ( /^\[.*\]$/.test( line ) ) {
            if ( !id ) {
                console.log( "Error: Found a description before an id -" + id );
            } else {
                obj.description = line.slice( 1, -1 );
            }
        }
    });
    return db;
};

var indexDB = function ( db, property ) {
    var output = {},
        obj, i, l;
    for ( i = 0, l = db.length; i < l; i += 1 ) {
        obj = db[ i ];
        output[ obj[ property ] ] = obj;
    }
    return output;
};

// PO Tools

var item = /^msg(ctxt|id|str)\s*(""|".*?[^\\]")\s*$/;
var extra = /^(""|".*?[^\\]")\s*$/;
var comment = /^#([.:,])\s(.*)$/;
var translateItemPart = {
    ctxt: 'id',
    id: 'string',
    str: 'translation'
};
var translateCommentPart = {
    ',': 'flag',
    '.': 'description',
    ':': 'context'
};

var parsePo = function ( text ) {
    var results = {},
        lines = text.split( '\n' ),
        obj = {},
        line, part, string,
        i, l, match, isPrev, flags;
    for ( i = 0, l = lines.length; i < l; i += 1 ) {
        line = lines[i];
        if ( !line ) {
            // New block
            obj = {};
            continue;
        }
        if ( /^#\| /.test( line ) ) {
            isPrev = true;
            line = line.slice( 3 );
        } else {
            isPrev = false;
        }
        match = item.exec( line );
        if ( match ) {
            part = translateItemPart[ match[1] ];
            try {
                string = JSON.parse( match[2] );
            } catch (e) {
                string = '';
                console.log( 'Parse error at line ' + ( i + 1 ) );
                console.log( 'Perhaps it contains control characters?' );
                console.log( match[2].split( '' ) );
            }
            while ( true ) {
                line = lines[ i + 1 ] || '';
                if ( isPrev ) {
                    if ( /^#| /.test( line ) ) {
                        line = line.slice( 3 );
                    } else {
                        break;
                    }
                }
                if ( !extra.test( line ) ) { break; }
                i += 1;
                try {
                    string += JSON.parse( lines[i] );
                } catch ( e ) {
                    console.log( 'Parse error at line ' + ( i + 1 ) );
                    console.log( lines[i] );
                }
            }
            // The empty string may be written as '[]'.
            // This is for legacy compatibility with translang's tools.
            if ( string === '[]' ) {
                string = '';
            }
            obj[ isPrev ? 'prevString' : part ] = string;
            if ( part === 'id' ) {
                results[ string ] = obj;
            }
            continue;
        }
        match = comment.exec( line );
        if ( match ) {
            part = translateCommentPart[ match[1] ];
            string = match[2];
            if ( part === 'flag' ) {
                flags = string.split( ',' ).map( function ( flag ) {
                    return flag.trim();
                });
                if ( obj.flags ) {
                    obj.flags = obj.flags.concat( flags );
                } else {
                    obj.flags = flags;
                }
            }
            if ( part === 'description' ) {
                if ( obj.description ) {
                    obj.description += ' ' + string;
                } else {
                    obj.description = string;
                }
            }
            if ( part === 'context' ) {
                if ( obj.context ) {
                    obj.context.push( string );
                } else {
                    obj.context = [ string ];
                }
            }
        }
    }
    return results;
};

// Enumeration and extraction

var extractor = /\.loc\(\s*'(.*?)'/g;

var indexFor = function ( array, number ) {
    var max = array.length,
        min = 0,
        mid;

    while ( min + 1 < max ) {
        mid = ( min + max ) >> 1;
        if ( number >= array[ mid ] ) {
            min = mid;
        } else {
            max = mid;
        }
    }

    return min;
};

var enumerate = function ( fileName, stringToEntry, textToScan, seen, ids ) {
    var match, id, lineNumber;
    var lines = textToScan.split( '\n' ).reduce(
    function ( array, line ) {
        var length = line.length,
            arrayLength = array.length;
        if ( arrayLength ) {
            length += array[ arrayLength - 1 ] + 1;
        }
        array[ arrayLength ] = length;
        return array;
    }, [] );
    extractor.lastIndex = 0;
    while ( match = extractor.exec( textToScan ) ) {
        id = match[1];
        if ( !isId.test( id ) ) {
            id = stringToEntry[ id ].id;
        }
        lineNumber = indexFor( lines, match.index );
        if ( !seen[ id ] ) {
            ids.push( id );
            seen[ id ] = {
                count: 1,
                uses: [ fileName + ':' + lineNumber ]
            };
        } else {
            seen[ id ].count += 1;
            seen[ id ].uses.push( fileName + ':' + lineNumber );
        }
    }
};

var extract = function ( dbFilePath, filesToScanPaths, outputPath, allData ) {
    fs.readFile( dbFilePath, 'utf8', function ( error, dbText ) {
        if ( error ) {
            console.log( 'Could not read dbFile' );
            return;
        }
        var db = parseDB( dbText ),
            stringToEntry = indexDB( db, 'string' ),
            seen = {},
            ids = [],
            l = filesToScanPaths.length;
        filesToScanPaths.forEach( function ( filePath ) {
            fs.readFile( filePath, 'utf8', function ( error, textToScan ) {
                if ( error ) {
                    console.log( 'Could not read ' + filePath );
                    return;
                }
                var fileName =
                        filePath.slice( filePath.lastIndexOf( '/' ) + 1 );
                enumerate( fileName, stringToEntry, textToScan, seen, ids );
                if ( ( l -= 1 ) ) {
                    return;
                }
                ids.sort( function ( id1, id2 ) {
                    return seen[ id1 ].count > seen[ id2 ].count ? -1 :
                        seen[ id1 ].count < seen[ id2 ].count ? 1 :
                        id1 < id2 ? -1 : 1;
                });
                fs.writeFile( outputPath,
                    JSON.stringify( allData ? seen : ids )
                );
            });
        });
    });
};

// Lang module

var formatHeaderLine = function ( text, length ) {
    return '// ' + text +
        new Array( length - 6 - text.length ).join(' ') + ' \\\\\n';
};

var _makeLangModule = function ( code, idList, idToEntry ) {

    var getString = function ( id ) {
        var obj = idToEntry[ id ];
        return obj ? obj.translation || obj.string : '';
    };

    var localisation = {
        code: code,
        dayNames: [
            getString( 'S_CALENDAR_SUNDAY' ),
            getString( 'S_CALENDAR_MONDAY' ),
            getString( 'S_CALENDAR_TUESDAY' ),
            getString( 'S_CALENDAR_WEDNESDAY' ),
            getString( 'S_CALENDAR_THURSDAY' ),
            getString( 'S_CALENDAR_FRIDAY' ),
            getString( 'S_CALENDAR_SATURDAY' )
        ],
        abbreviatedDayNames: [
            getString( 'S_CALENDAR_SHORT_HEADER_SUNDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_MONDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_TUESDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_WEDNESDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_THURSDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_FRIDAY' ),
            getString( 'S_CALENDAR_SHORT_HEADER_SATURDAY' )
        ],
        monthNames: [
            getString( 'D_JANUARY' ),
            getString( 'D_FEBRUARY' ),
            getString( 'D_MARS' ),
            getString( 'D_APRIL' ),
            getString( 'D_MAY' ),
            getString( 'D_JUNE' ),
            getString( 'D_JULY' ),
            getString( 'D_AUGUST' ),
            getString( 'D_SEPTEMBER' ),
            getString( 'D_OCTOBER' ),
            getString( 'D_NOVEMBER' ),
            getString( 'D_DECEMBER' )
        ],
        abbreviatedMonthNames: [
            getString( 'S_CALENDAR_JAN' ),
            getString( 'S_CALENDAR_FEB' ),
            getString( 'S_CALENDAR_MAR' ),
            getString( 'S_CALENDAR_APR' ),
            getString( 'S_CALENDAR_MAY' ),
            getString( 'S_CALENDAR_JUN' ),
            getString( 'S_CALENDAR_JUL' ),
            getString( 'S_CALENDAR_AUG' ),
            getString( 'S_CALENDAR_SEP' ),
            getString( 'S_CALENDAR_OCT' ),
            getString( 'S_CALENDAR_NOV' ),
            getString( 'S_CALENDAR_DEC' )
        ],

        decimalPoint: getString( 'S_FORMAT_DECIMAL_POINT' ),
        thousandsSeparator: getString( 'S_FORMAT_THOUSANDS_SEPARATOR' ),

        amDesignator: getString( 'S_CALENDAR_AM' ),
        pmDesignator: getString( 'S_CALENDAR_PM' ),

        use24hClock: getString( 'S_CALENDAR_FORMAT_TIME_DEFAULT' ) === '24h',

        dateFormats: {
            date: getString( 'S_CALENDAR_FORMAT_DATE' ),
            time12: getString( 'S_CALENDAR_FORMAT_TIME_12' ),
            time24: getString( 'S_CALENDAR_FORMAT_TIME_24' ),
            fullDate: getString( 'S_CALENDAR_FORMAT_FULL_DATE' ),
            fullDateAndTime:
                getString( 'S_CALENDAR_FORMAT_FULL_DATE_TIME' ),
            shortDayMonth: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH' ),
            shortDayMonthYear:
                getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH_YEAR' ),
            shortDayDate: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_DATE' )
        },
        
        translations: idList.map( getString )
    };

    return '' +
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        formatHeaderLine( 'File: ' + code + '.js', 80 ) +
        formatHeaderLine( 'Module: Locale', 80 ) +
        formatHeaderLine(
            'License: © 2010–2012 Opera Software ASA. All rights reserved.', 80
        ) +
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        '\n' +
        '( function () { var x = new O.Language(' +
            JSON.stringify( localisation, null, 2 ) +
        ');\nO.Localisation.addLanguage( x ).setLanguage("' + code + '")}() );';
};

var makeLangModule = function ( idListPath, poPath, outputPath ) {
    var code = /.*\/(.*)\.js/.exec( outputPath )[1],
        idList, idToEntry, output;
    fs.readFile( idListPath, 'utf8', function ( error, data ) {
        idList = JSON.parse( data );
        output();
    });
    fs.readFile( poPath, 'utf8', function ( error, data ) {
        idToEntry = parsePo( data );
        output();
    });
    output = function () {
        if ( !idList || !idToEntry ) {
            return;
        }
        fs.writeFile( outputPath,
            _makeLangModule( code, idList, idToEntry )
        );
    };
};

var insertLocale = function ( englishDbPath, strings, input, output ) {
    var db = parseDB( fs.readFileSync( englishDbPath, 'utf8' ) ),
        stringToEntry = indexDB( db, 'string' ),
        index = {};
    strings = JSON.parse( fs.readFileSync( strings, 'utf8' ) ),
    strings.forEach( function ( string, i ) {
        index[ string ] = i;
    });
    input = fs.readFileSync( input, 'utf8' );
    input = input.replace( extractor, function ( _, id ) {
        if ( !isId.test( id ) ) {
            id = stringToEntry[ id ].id;
        }
        return '.loc( ' + index[ id ];
    });

    fs.writeFile( output, input );
};

var updatePo = function ( englishDbPath, usagePath, inputPoPath, outputPoPath ) {
    var db = parseDB( fs.readFileSync( englishDbPath, 'utf8' ) ),
        inputPo = parsePo( fs.readFileSync( inputPoPath, 'utf8' ) ),
        usage = JSON.parse( fs.readFileSync( usagePath, 'utf8' ) ),
        output = '';

    db.forEach( function ( dbObj ) {
        var id = dbObj.id,
            poObj = inputPo[ id ],
            useObj = usage[ id ],

            description = dbObj.description,
            flags = poObj && poObj.flags || [],
            start, end;

        if ( description ) {
            start = 0;
            while ( true ) {
                end = start + 70;
                if ( end > description.length ) {
                    output += '#. ';
                    output += description.slice( start, description.length );
                    output += '\n';
                    break;
                } else {
                    end = description.lastIndexOf( ' ', end ) + 1;
                    if ( start === end ) {
                        end = start + 80;
                    }
                    output += '#. ';
                    output += description.slice( start, end );
                    output += '\n';
                    start = end;
                }
            }
        }
        if ( useObj ) {
            useObj.uses.forEach( function ( reference ) {
                output += '#: ' + reference + '\n';
            });
        }
        if ( ( !poObj || poObj.string !== dbObj.string ) &&
                flags.indexOf( 'fuzzy' ) < 0 ) {
            flags.push( 'fuzzy' );
        }
        if ( flags.length ) {
            output += '#, ' + flags.join( ', ' ) + '\n';
        }
        output += 'msgctxt ' + JSON.stringify( id ) + '\n';
        output += 'msgid ' + JSON.stringify( dbObj.string ) + '\n';
        output += 'msgstr ' +
            JSON.stringify( poObj && poObj.translation || '' );
        output += '\n\n';
    });

    fs.writeFile( outputPoPath, output );
};

var dbToPo = function ( englishDbPath, outputPoPath, makePot ) {
    var db = parseDB( fs.readFileSync( englishDbPath, 'utf8' ) ),
        output = '';

    db.forEach( function ( dbObj ) {
        var id = dbObj.id,
            description = dbObj.description,
            start, end;

        if ( description ) {
            start = 0;
            while ( true ) {
                end = start + 70;
                if ( end > description.length ) {
                    output += '#. ';
                    output += description.slice( start, description.length );
                    output += '\n';
                    break;
                } else {
                    end = description.lastIndexOf( ' ', end ) + 1;
                    if ( start === end ) {
                        end = start + 80;
                    }
                    output += '#. ';
                    output += description.slice( start, end );
                    output += '\n';
                    start = end;
                }
            }
        }
        output += 'msgctxt ' + JSON.stringify( id ) + '\n';
        output += 'msgid ' + JSON.stringify( dbObj.string ) + '\n';
        output += 'msgstr ' +
            ( makePot ? '""' : JSON.stringify( dbObj.string ) );
        output += '\n\n';
    });

    fs.writeFile( outputPoPath, output );
};

( function () {
    var args = process.argv.slice( 2 );
    switch ( args[0] ) {
        case 'enumerate':
            extract(
                // 1. EnglishDB
                // 2. Var args... files to scan
                // 3. Output
                // 4. All data
                args[1], args.slice( 2, -1 ), args[ args.length - 1 ], false
            );
            break;
        case 'findUses':
            extract(
                // 1. EnglishDB
                // 2. Var args... files to scan
                // 3. Output
                // 4. All data
                args[1], args.slice( 2, -1 ), args[ args.length - 1 ], true
            );
            break;
        case 'makeLangModule':
            // 1. Strings.json
            // 2. Lang.po
            // 3. Output
            makeLangModule( args[1], args[2], args[3] );
            break;
        case 'insertLocale':
            // 1. EnglishDb
            // 2. Strings.json
            // 3. Input
            // 4. Output
            insertLocale( args[1], args[2], args[3], args[4] );
            break;
        case 'dbToPo':
            dbToPo( args[1], args[2], false );
            break;
        case 'dbToPot':
            dbToPo( args[1], args[2], true );
            break;
        case 'updatePo':
            updatePo( args[1], args[2], args[3], args[4] );
            break;
    }
}() );