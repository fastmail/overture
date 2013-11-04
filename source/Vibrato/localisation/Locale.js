// -------------------------------------------------------------------------- \\
// File: Locale.js                                                            \\
// Module: Localisation                                                       \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var compileTranslation = function ( translation ) {
    var compiled = '',
        start = 0,
        searchIndex = 0,
        length = translation.length,
        end, parts, part, partLength,
        i, j, l;

    outer: while ( true ) {
        end = translation.indexOf( '[', searchIndex ) ;
        // If there are no more macros, just the last text section to
        // process.
        if ( end === -1 ) {
            end = length;
        } else {
            // Check the '[' isn't escaped (preceded by an odd number of
            // '~' characters):
            j = end;
            while ( j-- ) {
                if ( translation[ j ] !== '~' ) {
                    break;
                }
            }
            if ( ( end - j ) % 2 === 0 ) {
                searchIndex = end + 1;
                continue;
            }
        }
        // Standard text section
        part = translation.slice( start, end ).replace( /~(.)/g, '$1' );
        if ( part ) {
            if ( compiled ) { compiled += '+'; }
            compiled += '"';
            compiled += part.replace( /\\/g, '\\' )
                            .replace( /"/g, '\\"' );
            compiled += '"';
        }
        // Check if we've reached the end of the string
        if ( end === length ) { break; }
        // Macro section
        start = searchIndex = end + 1;
        // Find the end of the macro call.
        while ( true ) {
            end = translation.indexOf( ']', searchIndex );
            // Invalid translation string.
            if ( end === -1 ) {
                compiled = '';
                break outer;
            }
            // Check the ']' character isn't escaped.
            j = end;
            while ( j-- ) {
                if ( translation[ j ] !== '~' ) {
                    break;
                }
            }
            if ( ( end - j ) % 2 ) {
                break;
            }
            searchIndex = end + 1;
        }
        // Split into parts
        parts = translation.slice( start, end ).split( ',' );
        l = parts.length;

        if ( compiled ) {
            compiled += '+';
        }
        if ( l > 1 ) {
            compiled += 'lang.macros["';
        }
        for ( i = 0; i < l; i += 1 ) {
            // If not the first part, add a comma to separate the
            // arguments to the macro function call.
            if ( i > 1 ) {
                compiled += ',';
            }
            // If a comma was escaped, we split up an argument.
            // Rejoin these.
            part = parts[i];
            partLength = part.length;
            while ( partLength && part[ partLength - 1 ] === '~' ) {
                i += 1;
                part += ',';
                part += parts[i];
                partLength = part.length;
            }
            // Unescape the part.
            part = part.replace( /~(.)/g, '$1' );
            // Check if we've got an argument.
            if ( /^_(?:\*|\d+)$/.test( part ) ) {
                part = part.slice( 1 );
                compiled += 'args';
                compiled += ( part === '*' ?
                    '' : '[' + ( parseInt( part, 10 ) - 1 ) + ']'
                );
            }
            // Otherwise:
            else {
                // First part is the macro name.
                if ( !i ) {
                    compiled += ( part === '*' ?
                        'quant' : part === '#' ? 'numf' : part );
                    compiled += '"].call(lang,';
                }
                // Anything else is a plain string argument
                else {
                    compiled += '"';
                    compiled += part.replace( /\\/g, '\\' )
                                    .replace( /"/g, '\\"' );
                    compiled += '"';
                }
            }
        }
        if ( l > 1 ) {
            compiled += ')';
        }
        start = searchIndex = end + 1;
    }

    /*jshint evil: true */
    return new Function( 'lang', 'args',
    /*jshint evil: false */
        'return ' + ( compiled || '""' ) + ';'
    );
};

var formatInt = function ( number, locale ) {
    var string = number + '';
    if ( string.length > 3 ) {
        string = string.replace(
            /(\d+?)(?=(?:\d{3})+$)/g,
            '$1' + locale.thousandsSeparator
        );
    }
    return string;
};

/**
    Class: O.Locale

    Locale packs for use in localisation are created as instances of the
    O.Locale class.
*/
var Locale = NS.Class({

    /**
        Constructor: O.Locale

        Most options passed as the argument to this constructor are just added
        as properties to the object (and will override any inherited value for
        the same key). The following keys are special:

        code         - {String} The code for this locale. This *must* be
                       included.
        macros       - {Object} A mapping of key to functions, which may be used
                       inside the string translations (see documentation for the
                       translate method).
        translations - {Object} A mapping of key to string or function
                       specifying specific translations for this locale.
        dateFormats  - {Object} A mapping of key to (String|Date->String), each
                       taking a single Date object as an argument and outputing
                       a formatted date.

        Parameters:
            mixin - {Object} Information for this locale.
    */
    init: function ( mixin ) {
        [ 'macros', 'dateFormats' ].forEach( function ( obj ) {
            this[ obj ] = Object.create( this[ obj ] );
        }, this );
        this.compiled = {};
        NS.merge( this, mixin );
    },

    /**
        Property: O.Locale#code
        Type: String

        The ISO code for this locale.
    */
    code: 'xx',

    // === Numbers ===

    /**
        Property: O.Locale#decimalPoint
        Type: String

        The symbol used to divide the integer part from the decimal part of a
        number.
    */
    decimalPoint: '.',

    /**
        Property: O.Locale#thousandsSeparator
        Type: String

        The symbol used to divide large numbers up to make them easier to read.
    */
    thousandsSeparator: ',',

    /**
        Property: O.Locale#fileSizeUnits
        Type: Array.<String>

        An array containing the suffix denoting units of bytes, kilobytes,
        megabytes and gigabytes (in that order).
    */
    fileSizeUnits: [ 'B', 'KB', 'MB', 'GB' ],

    /**
        Method: O.Locale#getFormattedNumber

        Format a number according to local conventions. Ensures the correct
        symbol is used for a decimal point, and inserts thousands separators if
        used in the locale.

        Parameters:
            number - {(Number|String)} The number to format.

        Returns:
            {String} The localised number.
    */
    getFormattedNumber: function ( number ) {
        var integer = number + '',
            fraction = '',
            decimalPointIndex = integer.indexOf( '.' );
        if ( decimalPointIndex > -1 ) {
            fraction = integer.slice( decimalPointIndex + 1 );
            integer = integer.slice( 0, decimalPointIndex );
        }
        return formatInt( integer, this ) +
            ( fraction && this.decimalPoint + fraction );
    },

    /**
        Method: O.Locale#getFormattedFileSize

        Format a number of bytes into a locale-specific file size string.

        Parameters:
            bytes         - {Number} The number of bytes.
            decimalPlaces - {Number} (optional) The number of decimal places to
                            use in the result, if in MB or GB.

        Returns:
            {String} The localised, human-readable file size.
    */
    getFormattedFileSize: function ( bytes, decimalPlaces ) {
        var units = this.fileSizeUnits,
            l = units.length - 1,
            i = 0,
            ORDER_MAGNITUDE = 1000,
            number;
        while ( i < l && bytes >= ORDER_MAGNITUDE ) {
            bytes /= ORDER_MAGNITUDE;
            i += 1;
        }
        // B/KB to nearest whole number, MB/GB to 1 decimal place.
        number = ( i < 2 ) ?
            Math.round( bytes ) + '' :
            bytes.toFixed( decimalPlaces || 0 );
        // Use a &nbsp; to join the number to the unit.
        return this.getFormattedNumber( number ) + ' ' + units[i];
    },

    // === Date and Time ===

    /**
        Property: O.Locale#dayNames
        Type: Array.<String>

        Names of days of the week, starting from Sunday at index 0.
    */
    dayNames: [ 'Sunday', 'Monday', 'Tuesday',
        'Wednesday', 'Thursday', 'Friday', 'Saturday' ],
    /**
        Property: O.Locale#abbreviatedDayNames
        Type: Array.<String>

        Abbeviated names of days of the week, starting from Sunday at index 0.
    */
    abbreviatedDayNames: [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ],

    /**
        Property: O.Locale#monthNames
        Type: Array.<String>

        Names of months of the year, starting from January.
    */
    monthNames: [ 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December' ],

    /**
        Property: O.Locale#abbreviatedMonthNames
        Type: Array.<String>

        Abbeviated names of months of the year, starting from January.
    */
    abbreviatedMonthNames: [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ],

    /**
        Property: O.Locale#amDesignator
        Type: String

        The string used to designate AM. Will be the empty string in locales
        which do not use the 12h clock.
    */
    amDesignator: 'AM',

    /**
        Property: O.Locale#amDesignator
        Type: String

        The string used to designate PM. Will be the empty string in locales
        which do not use the 12h clock.
    */
    pmDesignator: 'PM',

    /**
        Property: O.Locale#use24hClock
        Type: Boolean

        Should the 24h clock be used?
    */
    use24hClock: true,

    /**
        Property: O.Locale#dateElementOrde
        Type: String

        Either 'dmy', 'mdy' or 'ymd', representing the order of day/month/year
        used in this locale to write dates.
    */
    dateElementOrder: 'dmy',

    /**
        Property: O.Locale#dateFormats
        Type: Object.<String,String>

        A set of string patterns for dates, in the format used with
        <Date#format>.
    */
    dateFormats: {
        date: '%d/%m/%Y',
        time: function ( date, locale, utc ) {
            return date.format(
                locale.use24hClock ? this.time24 : this.time12, utc );
        },
        time12: '%-I:%M %p',
        time24: '%H:%M',
        fullDate: '%A, %-d %B %Y',
        fullDateAndTime: '%A, %-d %B %Y %H:%M',
        abbreviatedFullDate: '%a, %-d %b %Y',
        shortDayMonth: '%-d %b',
        shortDayMonthYear: '%-d %b ’%y'
    },

    /**
        Property: O.Locale#datePatterns
        Type: Object.<String,RegExp>

        A set of regular expresions for matching key words used in dates.
    */
    datePatterns: {},

    /**
        Method: O.Locale#getFormattedDate

        Get a date or time formatted according to local conventions.

        Parameters:
            date - {Date} The date object to format.
            type - {String} The type of result you want, e.g. 'shortDate',
                   'time', 'fullDateAndTime'.
            utc  - {Boolean} (optional) If true, the UTC time of this date
                   object will be used when determining the date.

        Returns:
            {String} The localised date.
    */
    getFormattedDate: function ( date, type, utc ) {
        var dateFormats = this.dateFormats,
            format = dateFormats[ type ] || dateFormats.date;
        return format instanceof Function ?
            dateFormats[ type ]( date, this, utc ) : date.format( format, utc );
    },

    // === Strings ===

    /**
        Property: O.Locale#macros
        Type: Object.<String,Function>

        The set of named macros that may be used in translations using the
        square brackets notation.
    */
    macros: {
        // Japanese, Vietnamese, Korean.
        // Case 1: everything.
        // Case 2: is 0 (optional; case 1 used if not supplied).
        '*1': function ( n, singular, zero ) {
            return ( !n && zero !== undefined ? zero : singular
            ).replace( '%n', formatInt( n, this ) );
        },
        // Most Western languages.
        // Case 1: is 1.
        // Case 2: everything else.
        // Case 3: is 0 (optional; plural used if not supplied).
        '*2': function ( n, singular, plural, zero ) {
            return ( n === 1 ? singular :
                !n && zero !== undefined ? zero : plural
            ).replace( '%n', formatInt( n, this ) );
        },
        // French and Brazilian Portugese.
        // Case 1: is 0 or 1.
        // Case 2: everything else.
        // Case 3: is 0 (optional; singular used if not supplied).
        '*2a': function ( n, singular, plural, zero ) {
            return ( n > 1 ? plural :
                !n && zero !== undefined ? zero : singular
            ).replace( '%n', formatInt( n, this ) );
        },
        // Hungarian
        // Case 1: is 0,*3,*6,*8,*20,*30,*60,*80,*00,*000000, *000000+.
        // Case 2: everything else
        //        (*1,*2,*4,*5,*7,*9,*10,*40,*50,*70,*90,*000,*0000,*00000).
        // Case 3: is 0 (optional; case 1 used if not supplied)
        '*2b': function ( n, form1, form2, zero ) {
            return ( !n ? zero !== undefined ? zero : form1 :
                ( /(?:[368]|20|30|60|80|[^0]00|0{6,})$/.test( n + '' ) ) ?
                form1 : form2
            ).replace( '%n', formatInt( n, this ) );
        },
        // Latvian.
        // Case 1: is 0.
        // Case 2: ends in 1, does not end in 11.
        // Case 3: everything else.
        '*3a': function ( n, zero, plural1, plural2 ) {
            return (
                !n ? zero :
                n % 10 === 1 && n % 100 !== 11 ? plural1 : plural2
            ).replace( '%n', formatInt( n, this ) );
        },
        // Romanian.
        // Case 1: is 1.
        // Case 2: is 0 or ends in 01-19.
        // Case 3: everything else.
        // Case 4: is 0 (optional; case 2 used if not supplied)
        '*3b': function ( n, singular, plural1, plural2, zero ) {
            var mod100 = n % 100;
            return (
                !n && zero !== undefined ? zero :
                n === 1 ? singular :
                !n || ( 1 <= mod100 && mod100 <= 19 ) ? plural1 : plural2
            ).replace( '%n', formatInt( n, this ) );
        },
        // Lithuanian.
        // Case 1: ends in 1, not 11.
        // Case 2: ends in 0 or ends in 10-20.
        // Case 3: everything else.
        // Case 4: is 0 (optional; case 2 used if not supplied)
        '*3c': function ( n, form1, form2, form3, zero ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return (
                !n && zero !== undefined ? zero :
                mod10 === 1 && mod100 !== 11 ? form1 :
                mod10 === 0 || ( 10 <= mod100 && mod100 <= 20 ) ? form2 : form3
            ).replace( '%n', formatInt( n, this ) );
        },
        // Russian, Ukranian, Serbian, Croation.
        // Case 1: ends in 1, does not end in 11.
        // Case 2: ends in 2-4, does not end in 12-14.
        // Case 3: everything else
        // Case 4: is 0 (optional; case 3 used if not supplied)
        '*3d': function ( n, form1, form2, form3, zero ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return (
                !n && zero !== undefined ? zero :
                mod10 === 1 && mod100 !== 11 ? form1 :
                2 <= mod10 && mod10 <= 4 && ( mod100 < 12 || mod100 > 14 ) ?
                form2 : form3
            ).replace( '%n', formatInt( n, this ) );
        },
        // Czech, Slovak.
        // Case 1: is 1.
        // Case 2: is 2-4.
        // Case 3: everything else.
        // Case 4: is 0 (optional; case 3 used if not supplied)
        '*3e': function ( n, singular, plural1, plural2, zero ) {
            return (
                !n && zero !== undefined ? zero :
                n === 1 ? singular :
                2 <= n && n <= 4 ? plural1 : plural2
            ).replace( '%n', formatInt( n, this ) );
        },
        // Polish.
        // Case 1: is 1.
        // Case 2: ends in 2-4, does not end in 12-14.
        // Case 3: everything else
        // Case 4: is 0 (optional; case 3 used if not supplied)
        '*3f': function ( n, singular, plural1, plural2, zero ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return (
                !n && zero !== undefined ? zero :
                n === 1 ? singular :
                2 <= mod10 && mod10 <= 4 && ( mod100 < 12 || mod100 > 14 ) ?
                plural1 : plural2
            ).replace( '%n', formatInt( n, this ) );
        },
        // Slovenian, Sorbian.
        // Case 1: ends in 01.
        // Case 2: ends in 02.
        // Case 3: ends in 03 or 04.
        // Case 4: everything else.
        // Case 5: is 0 (optional; case 4 used if not supplied)
        '*4a': function ( n, end01, end02, end03or04, plural, zero ) {
            var mod100 = n % 100;
            return (
                !n && zero !== undefined ? zero :
                mod100 === 1 ? end01 :
                mod100 === 2 ? end02 :
                mod100 === 3 || mod100 === 4 ? end03or04 : plural
            ).replace( '%n', formatInt( n, this ) );
        },
        // Scottish Gaelic.
        // Case 1: is 1 or 11.
        // Case 2: is 2 or 12.
        // Case 3: is 3-19.
        // Case 4: everything else.
        // Case 5: is 0 (optional; case 4 used if not supplied)
        '*4b': function ( n, form1, form2, form3, form4, zero ) {
            return (
                !n && zero !== undefined ? zero :
                n === 1 || n === 11 ? form1 :
                n === 2 || n === 12 ? form2 :
                3 <= n && n <= 19 ? form3 : form4
            ).replace( '%n', formatInt( n, this ) );
        },
        // Gaeilge (Irish).
        // Case 1: is 1.
        // Case 2: is 2.
        // Case 3: is 3-6.
        // Case 4: is 7-10.
        // Case 5: everything else.
        // Case 5: is 0 (optional; case 5 used if not supplied)
        '*5': function ( n, singular, doubular, form1, form2, form3, zero ) {
            return (
                !n && zero !== undefined ? zero :
                n === 1 ? singular :
                n === 2 ? doubular :
                3 <= n && n <= 6 ? form1 :
                7 <= n && n <= 10 ? form2 : form3
            ).replace( '%n', formatInt( n, this ) );
        },
        // Arabic.
        // Case 1: is 0.
        // Case 2: is 1.
        // Case 3: is 2.
        // Case 4: ends in 03-10.
        // Case 5: ends in 11-99.
        // Case 6: everything else.
        '*6': function ( n, zero, singular, doubular, pl1, pl2, pl3 ) {
            var mod100 = n % 100;
            return (
                !n ? zero :
                n === 1 ? singular :
                n === 2 ? doubular :
                3 <= mod100 && mod100 <= 10 ? pl1 :
                11 <= mod100 && mod100 <= 99 ? pl2 : pl3
            ).replace( '%n', formatInt( n, this ) );
        },

        // The following four are deprecated and will be removed.
        quant: function ( n, singular, plural, zero ) {
            return ( !n && zero !== undefined ) ? zero :
                   ( n === 1 ) ? '1 ' + singular :
                   ( n + ' ' ) + ( plural || ( singular + 's' ) );
        },
        numerate: function ( n, singular, plural ) {
            return n !== 1 ? plural || ( singular + 's' ) : singular;
        },
        numf: function ( n ) {
            var parts = ( n + '' ).split( '.' );
            parts[0] = parts[0].replace( /(\d+?)(?=(?:\d{3})+$)/g,
                '$1' + this.thousandsSeparator );
            return parts.join( this.decimalPoint );
        },
        sprintf: function ( string ) {
            return String.prototype.format.apply( string,
                Array.prototype.slice.call( arguments, 1 ) );
        }
    },

    /**
        Property: O.Locale#translations
        Type: Object.<String,String>

        A map from the string identifier or English string to the localised
        string.
    */
    translations: {},

    /**
        Method: O.Locale#translate

        Get a localised version of a string.

        This method will first look up the string given as its first argument in
        the translations object for this locale. If it finds a value it will use
        that, otherwise it will use the original supplied string.

        If futher arguments are given, these are interpolated into the string.
        There are two different ways this can happen:

        1. If all the arguments are strings or numbers:

           Square brackets may be used inside strings to call macros; the syntax
           is the same as for Perl's maketext module. A macro is called like
           this: `[name,_1,arg2,arg3]`. Arguments are passed as literal strings,
           except if it is _n, where n is an integer. In this case, the argument
           will be argument n supplied at runtime to the translation method. To
           include a literal comma or close square bracket, precede it by a
           tilde. Macros are defined in the macro object of the locale and will
           be called with the locale object as the `this` parameter.

           The source string can also use a square bracket notation to just
           insert an argument, e.g.

               O.loc( "The city of [_1] is in [_2]", "Melbourne", "Australia" )
               => "The city of Melbourne is in Australia".

           The rules for pluralisation vary between languages, so if you have
           numbers you need to interpolate, your source string should use the
           appropriate pluralisation macro for your language. e.g.

               O.loc( "[*2,_1,1 file was,%n files were,No files were] found in [_2]", 11, "Documents" );
               => "11 files were found in Documents"

        2. If at least one of the arguments is an object:

           You cannot use macros, only "[_n]" placeholders. The result will be
           an array of string parts and your arguments. This can be useful when
           working with views, for example:

               O.Element.appendChildren( layer, O.loc(
                   "Searching [_1] for [_2]",
                   new O.SelectView({
                       value: O.bind(...),
                       options: [
                           { text: O.loc( "Everything" ),
                             value: true },
                           { text: O.loc( "Documents" ),
                             value: false }
                       ]
                   }),
                   el( 'b', {
                       text: O.bind(...)
                   })
               ));

        Parameters:
            string   - {String} The string to localise.
            var_args - {...(String|Number|Object)} The arguments to interpolate.

        Returns:
            {(String|Array)} The localised string or array of localised parts.
    */
    translate: function ( string ) {
        var translation = this.translations[ string ],
            returnString = true,
            args = [],
            i, l, arg, compiled, parts;

        if ( translation === undefined ) {
            translation = string;
        }

        for ( i = 1, l = arguments.length; i < l; i += 1 ) {
            arg = arguments[i];
            if ( typeof arg === 'object' ) {
                returnString = false;
            }
            args[ i - 1 ] = arg;
        }

        if ( returnString ) {
            compiled = this.compiled[ string ] ||
                ( this.compiled[ string ] = compileTranslation( translation ) );
            return compiled( this, args );
        }

        parts = translation.split( /\[_(\d)\]/ );
        for ( i = 1, l = parts.length; i < l; i += 2 ) {
            parts[i] = args[ parts[i] - 1 ] || null;
        }
        return parts;
    }
});

NS.Locale = Locale;

}( this.O ) );
