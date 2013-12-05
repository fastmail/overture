/*global require, process */

"use strict";

var fs = require( 'fs' );

var parseYear = function ( year ) {
    year = year.toLowerCase();
    if ( 'minimum'.indexOf( year ) === 0 ) {
        return -1e9;
    }
    if ( 'maximum'.indexOf( year ) === 0 ) {
        return 1e9;
    }
    if ( 'only'.indexOf( year ) === 0 ) {
        return 0;
    }
    var num = parseInt( year, 10 );
    if ( isNaN( num ) ) {
        throw 'Cannot parse year ' + year;
    }
    return num;
};

var months = {
    'jan': 0,
    'feb': 1,
    'mar': 2,
    'apr': 3,
    'may': 4,
    'jun': 5,
    'jul': 6,
    'aug': 7,
    'sep': 8,
    'oct': 9,
    'nov': 10,
    'dec': 11
};
var parseMonth = function ( month ) {
    var monthNum = months[ month.toLowerCase() ];
    if ( isNaN( monthNum ) ) {
        throw 'Cannot parse month ' + month;
    }
    return monthNum;
};
var isLeapYear = function ( year ) {
    return (
        ( ( year % 4 === 0 ) && ( year % 100 !== 0 ) ) || ( year % 400 === 0 )
    );
};
var daysInMonths = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
var getDaysInMonth = function ( month, year ) {
    return ( month === 1 && isLeapYear( year ) ) ?
        29 : daysInMonths[ month ];
};

var parseDateDay = function ( dateDay ) {
    var date = parseInt( dateDay.replace(/\D/g, '' ), 10 ) || 0;
    var day =
        /Sun(day)?/i.test( dateDay )     ? 1 :
        /Mon(day)?/i.test( dateDay )     ? 2 :
        /Tues?(day)?/i.test( dateDay )   ? 3 :
        /Wed(nesday)?/i.test( dateDay )  ? 4 :
        /Thur?s?(day)?/i.test( dateDay ) ? 5 :
        /Fri(day)?/i.test( dateDay )     ? 6 :
        /Sat(urday)?/i.test( dateDay )   ? 7 : 0;
    if ( day && !/>=/.test( dateDay ) ) {
        day = -day;
    }
    return [ date, day ];
};

var parseTime = function ( time ) {
    if ( time === '-' ) {
        return [ 0, 0, 0, 2 ];
    }
    var parts = /([+-])?([012]?\d)(?::([0-5]\d))?(?::([0-5]\d))?([wsguz])?/.exec( time );
    if ( !parts ) {
        throw 'Cannot parse time ' + time;
    }
    var sign = ( parts[1] === '-' ? -1 : 1 );
    return [
        sign * parseInt( parts[2] || 0, 10 ),
        sign * parseInt( parts[3] || 0, 10 ),
        sign * parseInt( parts[4] || 0, 10 ),
        parts[5] === 's' ? 1 : /[guz]/.test( parts[5] || '' ) ? 0 : 2
    ];
};

var formatRule = function ( parts ) {
    var dateDay = parseDateDay( parts[6] );
    var time = parseTime( parts[7] );
    var offset = parseTime( parts[8] );
    return [
        parseYear( parts[2] ),                          // Start year
        parseYear( parts[3] ) || parseYear( parts[2] ), // End year
        parseMonth( parts[5] ),                         // Month
        dateDay[0],                                     // Date (or 0 for last in month)
        dateDay[1],                                     // Day (0 for none, +/-1-7 for next/prev sun-sat)
        time[0],                                        // hour
        time[1],                                        // minute
        time[2],                                        // second
        time[3],                                        // utc=0/local=1/wall=2
        60 * ((60 * offset[0]) + offset[1]) + offset[2],// offset in seconds
        parts[9] === '-' ? '' : parts[9]                // letters
    ];
};

var formatZone = function ( parts ) {
    var offset = parseTime( parts[0] ),
        offsetInSeconds = 60 * ((60 * offset[0]) + offset[1]) + offset[2],
        year = parts[3] ? parseYear( parts[3] ) : 0,
        month = parts[4] ? parseMonth( parts[4] ) : 0,
        dateDay = parts[5] ? parseDateDay( parts[5] ) : [ 1, 0 ],
        date = dateDay[0] || getDaysInMonth( month, year ),
        day = dateDay[1],
        time = parseTime( parts[6] || '-' ),
        // TODO: We should check if a rule still applies at the transition point
        // and if so, adjust the offset to get UTC correctly.
        until = year ? new Date(Date.UTC(
            year, month, date, time[0], time[1], time[2]
        )) : 0;
    if ( day ) {
        offset = day > 0 ? 86400000 : -86400000;
        day = Math.abs( day ) - 1;
        while ( until.getUTCDay() !== day ) {
            until.setTime( +until + offset );
        }
    }
    if ( until && time[3] ) {
        until.setTime( until - offsetInSeconds * 1000 );
    }
    return [
        +until,          // Until (JS timestamp)
        offsetInSeconds, // offset (seconds)
        parts[1],        // Rules
        parts[2]         // Suffix
    ];
};

var sortZones = function ( a, b ) {
    if ( !a[0] ) {
        return 1;
    }
    if ( !b[0] ) {
        return -1;
    }
    return a[0] - b[0];
};
var sortRules = function ( a, b ) {
    return a[1] - b[1];
};

var convertFile = function ( text ) {
    var lines = text.replace( /#.*$/gm, '' ).split( '\n' ),
        zones = {},
        rules = {},
        usedRules = {},
        result = {
            link: {},
            zones: zones,
            rules: rules,
        },
        i, l, line, parts, zone, rule, parsedZone, id, periods;
    for ( i = 0, l = lines.length; i < l; i += 1 ) {
        line = lines[i].trim();
        // Comment
        if ( !line ) {
            continue;
        }
        parts = line.split( /\s+/ );
        if ( !parts.length ) {
            continue;
        }
        // console.log( 'parsing line ' + i + ': ' + line );
        switch ( parts[0] ) {
            case 'Link':
                result.link[ parts[2] ] = parts[1];
                break;
            case 'Rule':
                rule = formatRule( parts );
                // Ignore rules pre 1970
                if ( rule[1] < 1970 ) {
                    continue;
                }
                ( rules[ parts[1] ] || ( rules[ parts[1] ] = [] ) ).push( rule );
                break;
            case 'Zone':
                zone = parts[1];
                // Skip obsolete legacy timezones.
                if ( zone.indexOf( '/' ) === -1 ) {
                    continue;
                }
                parts = parts.slice( 2 );
                /* falls through */
            default:
                parsedZone = formatZone( parts );
                // Ignore rules pre 1970
                if ( parsedZone[0] < 0 ) {
                    continue;
                }
                usedRules[ parsedZone[2] ] = true;
                ( zones[ zone ] || ( zones[ zone ] = [] ) ).push(
                    parsedZone
                );
        }
    }

    // Now sort
    for ( id in zones ) {
        periods = zones[id];
        periods.sort( sortZones );
        // If the only rules are pre 1970, we may not have a rule block at all,
        // but the period could still reference it.
        periods.forEach( function( period ) {
            if ( !rules[ period[2] ] ) {
                period[2] = '-';
            }
        });
    }
    for ( id in rules ) {
        if ( !usedRules[ id ] ) {
            delete rules[ id ];
        } else {
            rules[ id ].sort( sortRules );
        }
    }
    return result;
};

var formatHeaderLine = function ( text, length ) {
    return '// ' + text +
        new Array( length - 6 - text.length + 1 ).join(' ') + ' \\\\\n';
};

// Usage: node olsonParser.js in out.json
( function () {
    var args = process.argv.slice( 2 );
    var olson = fs.readFileSync( args[0], 'utf8' );
    var json = convertFile( olson );
    var outputName = args[1];
    fs.writeFile( outputName,
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        formatHeaderLine( 'File: ' + outputName.slice( outputName.lastIndexOf( '/' ) + 1 ), 80 ) +
        formatHeaderLine( 'Module: TimeZones', 80 ) +
        formatHeaderLine(
            'License: Public Domain', 80
        ) +
        formatHeaderLine( new Array( 80 - 6 + 1 ).join( '-' ), 80 ) +
        '\n' +
        'O.TimeZone.load(' +
            JSON.stringify( json, null, 2 )
                .replace( /\n\s+((?:"[^"]*"|\-?\d+),?)$/gm, ' $1' )
                .replace( /([\d\"])\n\s*\]/g, '$1 ]' ) +
         ');\n'
    );
}() );
