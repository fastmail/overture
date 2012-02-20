/*global console, require, process */

"use strict";

var fs = require( 'fs' );
var item = /^msg(ctxt|str)\s*(""|".*?[^\\]")\s*$/;
var extra = /^(""|".*?[^\\]")\s*$/;

function readPo ( poFile ) {
    var results = {},
        lines = poFile.split( '\n' ),
        id, string,
        i, l, match;
    for ( i = 0, l = lines.length; i < l; i += 1 ) {
        match = item.exec( lines[ i ] );
        if ( match ) {
            if ( match[1] === 'ctxt' ) {
                id = JSON.parse( match[2] );
            } else {
                try {
                    string = JSON.parse( match[2] );
                } catch (e) {
                    string = '';
                    console.log( 'Parse error at line ' + ( i + 1 ) );
                    console.log( 'Perhaps it contains control characters?' );
                    console.log( match[2].split( '' ) );
                }
                while ( extra.test( lines[ i + 1 ] || '' ) ) {
                    i += 1;
                    string += JSON.parse( lines[i] );
                }
                results[ id ] = string;
            }
        }
    }
    return results;
}

function makeLangFile( defaults, strings, output ) {
    if ( !output ) {
        output = defaults;
        defaults = strings;
    }
    strings = readPo( fs.readFileSync( strings, 'utf8' ) );
    defaults = readPo( fs.readFileSync( defaults, 'utf8' ) );
    
    var code = /.*\/(.*)\.js/.exec( output )[1];
    
    var getString = function ( id ) {
        var string = strings[ id ];
        if ( string === undefined ) {
            string = defaults[ id ];
        }
        if ( string === undefined ) {
            string = '';
        }
        return string;
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
            fullDateAndTime:
                getString( 'S_CALENDAR_FORMAT_FULL_DATE_TIME' ),
            shortDayMonth: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH' ),
            shortDayMonthYear:
                getString( 'S_CALENDAR_FORMAT_SHORT_DAY_MONTH_YEAR' ),
            shortDayDate: getString( 'S_CALENDAR_FORMAT_SHORT_DAY_DATE' )
        }
    };
    
    fs.writeFile( output, JSON.stringify( localisation, null, 2 ) );
}

// Usage: node makeformats.js default.po in.po out.json
( function () {
    makeLangFile.apply( null, process.argv.slice( 2 ) );
}() );