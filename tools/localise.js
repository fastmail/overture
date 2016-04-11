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

var trim = function ( string ) {
    return string.trim();
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
                flags = string.split( ',' ).map( trim );
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
            if ( !stringToEntry[ id ] ) {
                console.log( id );
            }
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
            ids = [];
        filesToScanPaths.forEach( function ( filePath ) {
            var textToScan = fs.readFileSync( filePath, 'utf8' );
            var fileName = filePath.slice( filePath.lastIndexOf( '/' ) + 1 );
            enumerate( fileName, stringToEntry, textToScan, seen, ids );
        });
        ids.sort( function ( id1, id2 ) {
            return seen[ id1 ].count > seen[ id2 ].count ? -1 :
                seen[ id1 ].count < seen[ id2 ].count ? 1 :
                id1 < id2 ? -1 : 1;
        });
        fs.writeFile( outputPath,
            JSON.stringify( allData ? seen : ids )
        );
    });
};

// Lang module

var divide = function ( strings, index ) {
    var output = [];
    var i, l, ll, buckets, string, character;
    while ( l = strings.length ) {
        buckets = [];
        for ( i = 0; i < l; i += 1 ) {
            string = strings[i];
            character = string[ index ] || '';
            ll = buckets.length;
            while ( ll-- ) {
                if ( buckets[ll].character === character ) {
                    buckets[ll].strings.push( string );
                    break;
                }
            }
            if ( ll === -1 ) {
                buckets.push({
                    character: character,
                    strings: [ string ]
                });
            }
        }
        if ( buckets.length === 1 ) {
            output.push( character );
            if ( !character ) { break; }
            index += 1;
        } else {
            output.push(
                buckets.map( function ( bucket ) {
                    return divide( bucket.strings, index );
                })
            );
            break;
        }
    }
    return output;
};

var escapeRegExp = function ( string ) {
    return string.replace( /([\-.*+?\^${}()|\[\]\/\\])/g, '\\$1' );
};

var join = function ( strings ) {
    var output = '',
        i, l, part, optional, section;
    for ( i = 0, l = strings.length; i < l; i += 1 ) {
        part = strings[i];
        if ( typeof part === 'string' ) {
            output += escapeRegExp( part );
        } else {
            optional = part.some( function ( array ) {
                return array[0] === '';
            });
            section = part.filter( function ( array ) {
                return !!array[0];
            }).map( function ( array ) {
                return join( array );
            }).join( '|' );
            if ( section.length > 1 ) {
                section = '(?:' + section + ')';
            }
            if ( optional ) {
                section += '?';
            }
            output += section;
        }
    }
    return output;
};

var makeRegExp = function ( strings ) {
    var regexp = join( divide( strings, 0 ) );
    return '/^' + regexp + '\\b/i';
};

var formatHeaderLine = function ( text, length ) {
    return '// ' + text +
        new Array( length - 6 - text.length + 1 ).join(' ') + ' \\\\\n';
};

// Going to insert functions into our object.
Function.prototype.toJSON = function () {
    return this.toString();
};

var _makeLangModule = function ( code, idList, idToEntry ) {

    var getString = function ( id ) {
        var obj = idToEntry[ id ];
        return obj ? obj.translation || obj.string : '';
    };

    var localisation = {
        code: code,

        decimalPoint: getString( 'S_FORMAT_DECIMAL_POINT' ),
        thousandsSeparator: getString( 'S_FORMAT_THOUSANDS_SEPARATOR' ),

        getFormattedOrdinal:
        /^en/.test( code ) ?
            function ( number ) {
                var mod10 = number % 10,
                    mod100 = number % 100;
                return number + (
                    mod10 === 1 && mod100 !== 11 ? 'st' :
                    mod10 === 2 && mod100 !== 12 ? 'nd' :
                    mod10 === 3 && mod100 !== 13 ? 'rd' :
                                                   'th'
                );
            } :
        code === 'nl' ?
            function ( number ) {
                return number + 'e';
            } :
            undefined,

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
            getString( 'D_MARCH' ),
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

        amDesignator: getString( 'S_CALENDAR_AM' ),
        pmDesignator: getString( 'S_CALENDAR_PM' ),

        use24hClock: getString( 'S_CALENDAR_FORMAT_TIME_DEFAULT' ) === '24h',
        dateElementOrder: ( function () {
            var format = getString( 'S_CALENDAR_FORMAT_DATE' ),
                year = /%\-?Y/i.exec( format ).index,
                month = /%\-?[mb]/i.exec( format ).index,
                day = /%\-?d/i.exec( format ).index;
            return year < month && year < day ? 'ymd' :
                month < day ? 'mdy' : 'dmy';
        }() ),

        dateFormats: {
            date: getString( 'S_CALENDAR_FORMAT_DATE' ),
            time12: getString( 'S_CALENDAR_FORMAT_TIME_12' ),
            time24: getString( 'S_CALENDAR_FORMAT_TIME_24' ),
            fullDate: getString( 'S_CALENDAR_FORMAT_FULL_DATE' ),
            fullDateAndTime:
                getString( 'S_CALENDAR_FORMAT_FULL_DATE_TIME' ),
            abbreviatedFullDate: getString( 'S_CALENDAR_FORMAT_FULL_DATE' )
                .replace( '%A', '%a' ).replace( '%B', '%b' ),
            shortDayMonth: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH' ),
            shortDayMonthYear:
                getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH_YEAR' ),
            shortDayDate: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_DATE' ),
            shortMonthYear: getString( 'S_CALENDAR_FORMAT_SHORT_MONTH_YEAR' )
        },
        datePatterns: {
            jan: makeRegExp([
                getString( 'D_JANUARY' ),
                getString( 'S_CALENDAR_JAN' )
            ]),
            feb: makeRegExp([
                getString( 'D_FEBRUARY' ),
                getString( 'S_CALENDAR_FEB' )
            ]),
            mar: makeRegExp([
                getString( 'D_MARCH' ),
                getString( 'S_CALENDAR_MAR' )
            ]),
            apr: makeRegExp([
                getString( 'D_APRIL' ),
                getString( 'S_CALENDAR_APR' )
            ]),
            may: makeRegExp([
                getString( 'D_MAY' ),
                getString( 'S_CALENDAR_MAY' )
            ]),
            jun: makeRegExp([
                getString( 'D_JUNE' ),
                getString( 'S_CALENDAR_JUN' )
            ]),
            jul: makeRegExp([
                getString( 'D_JULY' ),
                getString( 'S_CALENDAR_JUL' )
            ]),
            aug: makeRegExp([
                getString( 'D_AUGUST' ),
                getString( 'S_CALENDAR_AUG' )
            ]),
            sep: makeRegExp([
                getString( 'D_SEPTEMBER' ),
                getString( 'S_CALENDAR_SEP' )
            ]),
            oct: makeRegExp([
                getString( 'D_OCTOBER' ),
                getString( 'S_CALENDAR_OCT' )
            ]),
            nov: makeRegExp([
                getString( 'D_NOVEMBER' ),
                getString( 'S_CALENDAR_NOV' )
            ]),
            dec: makeRegExp([
                getString( 'D_DECEMBER' ),
                getString( 'S_CALENDAR_DEC' )
            ]),

            mon: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_MONDAY' ),
                getString( 'S_CALENDAR_MONDAY' )
            ]),
            tue: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_TUESDAY' ),
                getString( 'S_CALENDAR_TUESDAY' )
            ]),
            wed: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_WEDNESDAY' ),
                getString( 'S_CALENDAR_WEDNESDAY' )
            ]),
            thu: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_THURSDAY' ),
                getString( 'S_CALENDAR_THURSDAY' )
            ]),
            fri: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_FRIDAY' ),
                getString( 'S_CALENDAR_FRIDAY' )
            ]),
            sat: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_SATURDAY' ),
                getString( 'S_CALENDAR_SATURDAY' )
            ]),
            sun: makeRegExp([
                getString( 'S_CALENDAR_SHORT_HEADER_SUNDAY' ),
                getString( 'S_CALENDAR_SUNDAY' )
            ]),

            past: makeRegExp(
                getString( 'TIME_PAST_KEYWORDS' ).split( ' ' )
            ),
            future: makeRegExp(
                getString( 'TIME_FUTURE_KEYWORDS' ).split( ' ' )
            ),
            add: makeRegExp([
                getString( 'TIME_AFTER' ),
                '+'
            ]),
            subtract: makeRegExp([
                getString( 'TIME_BEFORE' ),
                '-'
            ]),

            yesterday: makeRegExp([ getString( 'TIME_YESTERDAY' ) ]),
            today: makeRegExp([ getString( 'TIME_TODAY' ) ]),
            tomorrow: makeRegExp([ getString( 'TIME_TOMORROW' ) ]),
            now: makeRegExp([ getString( 'TIME_NOW' ) ]),

            // millisecond: '/^ms|milli(?:second)?s?\\b/i',
            // second: '/^sec(?:ond)?s?\\b/i',
            // minute: '/^min(?:ute)?s?\\b/i',
            // hour: '/^h(?:ou)?rs?\\b/i',
            // week: '/^w(?:ee)?k\\b/i',
            // month: '/^m(?:o(?:nth)?s?)?\\b/i',
            // day: '/^d(?:ays?)?\\b/i',
            // year: '/^y(?:(?:ea)?rs?)?\\b/i',

            am: '/^(?:a\\.?m?\\.?)(?=\s|$)/i',
            pm: '/^(?:p\\.?m?\\.?)(?=\s|$)/i',

            ordinalSuffix: '/^\\s*(?:st|nd|rd|th)\\b/i',
            timeContext: '/^\\s*(?:\\:|am|pm)/i'
        },

        translations: idList.map( getString )
    };

    return '' +
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        formatHeaderLine( 'File: ' + code + '.js', 80 ) +
        formatHeaderLine( 'Module: Locale', 80 ) +
        formatHeaderLine(
            'License: © 2010–' + new Date().getFullYear() + ' FastMail Pty Ltd. MIT Licensed.       ', 80
        ) +
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        '\n' +
        '( function () { var x = new O.Locale(' +
            JSON.stringify( localisation, null, 2 )
                .replace( /"(\/\^.*?\/i)"/g, function ( _, regexp ) {
                    return regexp.replace( /\\\\/g, '\\' );
                })
                .replace( /"(function[\s\S]*?})"/g, function ( _, fn ) {
                    return fn.replace( /\\n/g, '\n' );
                }) +
        ');\nO.i18n.addLocale( x ).setLocale("' + code + '")}() );';
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
    strings = JSON.parse( fs.readFileSync( strings, 'utf8' ) );
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
        // usage = JSON.parse( fs.readFileSync( usagePath, 'utf8' ) ),
        output = '';

    db.forEach( function ( dbObj ) {
        var id = dbObj.id,
            poObj = inputPo[ id ],
            // useObj = usage[ id ],

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
        // if ( useObj ) {
        //     useObj.uses.forEach( function ( reference ) {
        //         output += '#: ' + reference + '\n';
        //     });
        // }
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
