/*global require, process, console */

"use strict";

var fs = require( 'fs' );

var extractor = /\.loc\(\s*'(.*?)'/g;
var isId = /^[A-Z0-9_]+$/;

var getSearchRegExp = function ( id ) {
    return new RegExp( '^([A-Z0-9_]+)\\.caption="' +
        id.replace( /([\-.*+?\^${}()|\[\]\/\\])/g, '\\$1' ) + '"', 'gm' );
};

var getIdFromDb = function ( id, englishDb, scope ) {
    var search = getSearchRegExp( id ),
        idmatch, scopeRegExp;
    while ( idmatch = search.exec( englishDb ) ) {
        id = idmatch[1];
        scopeRegExp = new RegExp( '^' + id + '\\.scope=".*?"', 'm' );
        idmatch = scopeRegExp.exec( englishDb );
        if ( idmatch && idmatch[0].indexOf( scope ) > -1 ) {
            break;
        }
    }
    return id;
};

var enumerate = function ( englishDb, scope, filesToScan, output ) {
    var seen = {},
        ids = [];
    englishDb = fs.readFileSync( englishDb, 'utf8' );
    filesToScan.forEach( function ( file ) {
        var source = fs.readFileSync( file, 'utf8' ),
            match, id;
        extractor.lastIndex = 0;
        while ( match = extractor.exec( source ) ) {
            id = match[1];
            if ( !isId.test( id ) ) {
                id = getIdFromDb( id, englishDb, scope );
            }
            if ( !seen[ id ] ) {
                ids.push( id );
            }
            seen[ id ] = ( seen[ id ] || 0 ) + 1;
        }
    });
    ids.sort( function ( id1, id2 ) {
        return seen[ id1 ] > seen[ id2 ] ? -1 :
            seen[ id1 ] < seen[ id2 ] ? 1 :
            id1 < id2 ? -1 : 1;
    });
    fs.writeFile( output, JSON.stringify( ids ) );
};

var item = /^msg(ctxt|str)\s*(""|".*?[^\\]")\s*$/;
var extra = /^(""|".*?[^\\]")\s*$/;

var parsePo = function ( poFile ) {
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
                // The empty string is written as '[]'.
                // This is for legacy compatibility with translang's tools.
                if ( string === '[]' ) { string = ''; }
                
                results[ id ] = string;
            }
        }
    }
    return results;
};

var makeLangModule = function ( stringList, strings, defaults, output ) {
    if ( !output ) {
        output = defaults;
        defaults = strings;
    }
    stringList = JSON.parse( fs.readFileSync( stringList, 'utf8' ) );
    strings = parsePo( fs.readFileSync( strings, 'utf8' ) );
    defaults = parsePo( fs.readFileSync( defaults, 'utf8' ) );
    
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
        },
        
        translations: stringList.map( getString )
    };
    
    var space = new Array( 80 - 14 - code.length + 1 ).join(' ');
    
    fs.writeFile( output,
        '// ' + new Array( 80 - 6 + 1 ).join( '-' ) + ' \\\\\n' +
        '// File: ' + code + '.js' + space          +  '\\\\\n' +
        '// Module: Locale' + new Array( 80 - 19 + 1 ).join( ' ' ) + '\\\\\n' +
        '// License: © 2010–2011 Opera Software ASA. All rights reserved.' +
                '              \\\\\n' +
        '// ' + new Array( 80 - 6 + 1 ).join( '-' ) + ' \\\\\n\n' +
        '( function () { var x = new O.Language(' +
            JSON.stringify( localisation, null, 2 ) +
        ');\nO.Localisation.addLanguage( x ).setLanguage("' + code + '")}() );'
    );
};

var insertLocale = function ( englishDb, scope, strings, input, output ) {
    englishDb = fs.readFileSync( englishDb, 'utf8' );
    strings = JSON.parse( fs.readFileSync( strings, 'utf8' ) );
    input = fs.readFileSync( input, 'utf8');
    input = input.replace( extractor, function ( _, id ) {
        if ( !isId.test( id ) ) {
            id = getIdFromDb( id, englishDb, scope );
        }
        return '.loc( ' + strings.indexOf( id );
    });
    
    fs.writeFile( output, input );
};

( function () {
    var args = process.argv.slice( 2 );
    switch ( args[0] ) {
        case 'enumerate':
            enumerate(
                // 1. EnglishDB
                // 2. Scope
                // 3. Var args... files to scan
                // 4. Output
                args[1], args[2], args.slice( 3, -1 ), args[ args.length - 1 ]
            );
            break;
        case 'makeLangModule':
            // 1. Strings.json
            // 2. Lang.po
            // 3. Default.po
            // 4. Output
            makeLangModule( args[1], args[2], args[3], args[4] );
            break;
        case 'insertLocale':
            // 1. EnglishDb
            // 2. Scope
            // 3. Strings.json
            // 4. Input
            // 5. Output
            insertLocale( args[1], args[2], args[3], args[4], args[5] );
            break;
    }
}() );