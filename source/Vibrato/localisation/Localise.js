// -------------------------------------------------------------------------- \\
// File: Localise.js                                                          \\
// Module: Localisation                                                       \\
// Requires: Core                                                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function ( NS, undefined ) {

/**
    Module: Localisation
    
    The Localisation module provides classes for localising an interface.
*/
    
Date.implement({
    /**
        Method: Date#isOnSameDayAs
        
        Returns the difference in time between the date given in the sole
        argument (or now if not supplied) and this date, in a human friendly,
        localised form. e.g. 5 hours 3 minutes ago.
        
        Parameters:
            date - {Date} Date to compare it to.
        
        Returns:
            {String} Relative date string.
    */
    relativeTo: function ( date ) {
        if ( !date ) { date = new Date(); }
        
        var diffSeconds = ( date - this ) / 1000,
            isFuture = ( diffSeconds < 0 ),
            time;
        
        if ( isFuture ) {
          diffSeconds = -diffSeconds;
        }
        
        if ( diffSeconds < 60 ) {
            time = NS.loc( 'less than a minute' );
        } else if ( diffSeconds < 3600 ) {
            time = NS.loc( '[*,_1,minute]', ~~( diffSeconds / 60 ) );
        } else if ( diffSeconds < 86400 ) {
            time = NS.loc( '[*,_1,hour,hours,] [*,_2,minute,minutes,]',
                ~~( diffSeconds / 3600 ), ~~( diffSeconds / 60 ) % 60 );
        } else if ( diffSeconds < 604800 ) {
            time = NS.loc( '[*,_1,day,days,] [*,_2,hour,hours,]',
                ~~( diffSeconds / 86400 ), ~~( diffSeconds / 3600 ) % 24 );
        } else if ( diffSeconds < 3628800 ) {
            time = NS.loc( '[*,_1,week,weeks,] [*,_2,day,days,]',
                ~~( diffSeconds / 604800 ), ~~( diffSeconds / 86400 ) % 7 );
        } else {
            var years = date.getFullYear() - this.getFullYear(),
                months = date.getMonth() - this.getMonth();
            
            if ( isFuture ) {
                years = -years;
                months = -months;
            }
            if ( months < 0 ) {
                years -= 1;
                months += 12;
            }
            time = NS.loc( '[*,_1,year,years,] [*,_2,month,months,]',
                        years, months );
        }
        
        time = time.trim();
        
        return isFuture ?
            NS.loc( '[_1] from now', time ) : NS.loc( '[_1] ago', time );
    }
});

var slice = Array.prototype.slice,
    interpolate = String.prototype.interpolate;

/**
    Class: O.Language
    
    Language packs for use in localisation are created as instances of the
    O.Language class.
*/
var Language = NS.Class({
    
    /**
        Constructor: O.Language

        Most options passed as the argument to this constructor are just added
        as properties to the object (and will override any inherited value for
        the same key). The following keys are special:

        code         - {String} The code for this language. This *must* be
                       included.
        macros       - {Object} A mapping of key to functions, which may be used
                       inside the string translations (see documentation for the
                       translate method).
        translations - {Object} A mapping of key to string or function
                       specifying specific translations for this language.
        dateFormats  - {Object} A mapping of key to (String|Date->String), each
                       taking a single Date object as an argument and outputing
                       a formatted date.

        Parameters:
            options - {Object} Locale information for this language.
    */
    init: function ( options ) {
        [ 'macros', 'dateFormats' ].forEach( function ( obj ) {
            this[ obj ] = Object.create( this[ obj ] );
        }, this );
        NS.merge( this, options );
    },
    
    /**
        Property: O.Language#code
        Type: String
        
        The ISO code for this language.
    */
    code: 'xx',
    
    /**
        Property: O.Language#dayNames
        Type: Array.<String>
        
        Names of days of the week, starting from Sunday at index 0.
    */
    dayNames: [ 'Sunday', 'Monday', 'Tuesday',
        'Wednesday', 'Thursday', 'Friday', 'Saturday' ],
    /**
        Property: O.Language#abbreviatedDayNames
        Type: Array.<String>

        Abbeviated names of days of the week, starting from Sunday at index 0.
    */
    abbreviatedDayNames: [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ],
    
    /**
        Property: O.Language#monthNames
        Type: Array.<String>

        Names of months of the year, starting from January.
    */
    monthNames: [ 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December' ],

    /**
        Property: O.Language#abbreviatedMonthNames
        Type: Array.<String>

        Abbeviated names of months of the year, starting from January.
    */
    abbreviatedMonthNames: [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ],
    
    /**
        Property: O.Language#decimalPoint
        Type: String

        The symbol used to divide the integer part from the decimal part of a
        number.
    */
    decimalPoint: '.',
    
    /**
        Property: O.Language#thousandsSeparator
        Type: String

        The symbol used to divide large numbers up to make them easier to read.
    */
    thousandsSeparator: ',',
    
    /**
        Property: O.Language#amDesignator
        Type: String

        The string used to designate AM. Will be the empty string in languages
        which do not use the 12h clock.
    */
    amDesignator: 'AM',
    
    /**
        Property: O.Language#amDesignator
        Type: String

        The string used to designate PM. Will be the empty string in languages
        which do not use the 12h clock.
    */
    pmDesignator: 'PM',
    
    /**
        Property: O.Language#macros
        Type: Object.<String,Function>

        The set of named macros that may be used in translations using the
        square brackets notation.
    */
    macros: {
        // Japanese, Vietnamese, Korean.
        // Case 1: everything.
        '*1': function ( n, singular, zero ) {
            return ( ( !n && zero ) || singular ).interpolate( n );
        },
        // Most Western languages.
        // Case 1: is 1.
        // Case 2: everything else.
        // Case 3: is 0 (optional; plural used otherwise).
        '*2': function ( n, singular, plural, zero ) {
            return ( n === 1 ? singular :
                ( !n && zero ) || plural ).interpolate( n );
        },
        // French and Brazilian Portugese.
        // Case 1: is 0 or 1.
        // Case 2: everything else.
        // Case 3: is 0 (optional, uses singular if not supplied).
        '*2a': function ( n, singular, plural, zero ) {
            return ( n > 1 ? plural :
                ( !n && zero ) || singular ).interpolate( n );
        },
        // Hungarian
        // Case 1: is 0,*3,*6,*8,*20,*30,*60,*80,*00,*000000, *000000+.
        // Case 2: everything else
        //        (*1,*2,*4,*5,*7,*9,*10,*40,*50,*70,*90,*000,*0000,*00000).
        // Case 3: is O (optional, will use case 1 if not supplied)
        '*2b': function ( n, form1, form2, zero ) {
            return ( !n ? zero || form1 :
                ( /(?:[368]|20|30|60|80|[^0]00|0{6,})$/.test( n + '' ) ) ?
                form1 : form2 ).interpolate( n );
        },
        // Latvian.
        // Case 1: is 0.
        // Case 2: ends in 1, does not end in 11.
        // Case 3: everything else.
        '*3a': function ( n, zero, plural1, plural2 ) {
            return ( n === 0 ? zero :
                ( n % 10 === 1 && n % 100 !== 11 ) ? plural1 : plural2
            ).interpolate( n );
        },
        // Romanian.
        // Case 1: is 1.
        // Case 2: is 0 or ends in 01-19.
        // Case 3: everything else.
        '*3b': function ( n, singular, plural1, plural2, zero ) {
            var mod100 = n % 100;
            return ( ( n === 1 ) ? singular :
                ( n === 0 || ( 1 <= mod100 && mod100 <= 19 ) ) ?
                plural1 : plural2
            ).interpolate( n );
        },
        // Lithuanian.
        // Case 1: ends in 1, not 11.
        // Case 2: ends in 0 or ends in 10-20.
        // Case 3: everything else.
        '*3c': function ( n, form1, form2, form3 ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return ( ( mod10 === 1 && mod100 !== 11 ) ? form1 :
                ( mod10 === 0 || ( 10 <= mod100 && mod100 <= 20 ) ) ?
                form2 : form3
            ).interpolate( n );
        },
        // Russian, Ukranian, Serbian, Croation.
        // Case 1: ends in 1, does not end in 11.
        // Case 2: ends in 2-4, does not end in 12-14.
        // Case 3: everything else
        '*3d': function ( n, form1, form2, form3 ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return ( ( mod10 === 1 && mod100 !== 11 ) ? form1 :
                2 <= mod10 && mod10 <= 4 && ( mod100 < 12 || mod100 > 14 ) ?
                form2 : form3
            ).interpolate( n );
        },
        // Czech, Slovak.
        // Case 1: is 1.
        // Case 2: is 2-4.
        // Case 3: everything else.
        '*3e': function ( n, singular, plural1, plural2 ) {
            return ( n === 1 ? singular :
                2 <= n && n <= 4 ? plural1 : plural2
            ).interpolate( n );
        },
        // Polish.
        // Case 1: is 1.
        // Case 2: ends in 2-4, does not end in 12-14.
        // Case 3: everything else
        '*3f': function ( n, singular, plural1, plural2 ) {
            var mod10 = n % 10,
                mod100 = n % 100;
            return ( n === 1 ? singular :
                2 <= mod10 && mod10 <= 4 && ( mod100 < 12 || mod100 > 14 ) ?
                plural1 : plural2
            ).interpolate( n );
        },
        // Slovenian, Sorbian.
        // Case 1: ends in 01.
        // Case 2: ends in 02.
        // Case 3: ends in 03 or 04.
        // Case 4: everything else.
        '*4a': function ( n, end01, end02, end03or04, plural ) {
            var mod100 = n % 100;
            return ( mod100 === 1 ? end01 :
                mod100 === 2 ? end02 :
                mod100 === 3 || mod100 === 4 ? end03or04 : plural
            ).interpolate( n );
        },
        // Scottish Gaelic.
        // Case 1: is 1 or 11.
        // Case 2: is 2 or 12.
        // Case 3: is 3-19.
        // Case 4: everything else.
        '*4b': function ( n, form1, form2, form3, form4 ) {
            return ( ( n === 1 || n === 11 ) ? form1 :
                ( n === 2 || n === 12 ) ? form2 :
                ( 3 <= n && n <= 19 ) ? form3 : form4
            ).interpolate( n );
        },
        // Gaeilge (Irish).
        // Case 1: is 1.
        // Case 2: is 2.
        // Case 3: is 3-6.
        // Case 4: is 7-10.
        // Case 5: everything else.
        '*5': function ( n, singular, doubular, plural1, plural2, plural3 ) {
            return ( ( n === 1 ) ? singular :
                ( n === 2 ) ? doubular :
                ( 3 <= n && n <= 6 ) ? plural1 :
                ( 7 <= n && n <= 10 ) ? plural2 : plural3
            ).interpolate( n );
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
            return ( ( n === 0 ) ? zero :
                ( n === 1 ) ? singular :
                ( n === 2 ) ? doubular :
                ( 3 <= mod100 && mod100 <= 10 ) ? pl1 :
                ( 11 <= mod100 && mod100 <= 99 ) ? pl2 : pl3
            ).interpolate( n );
        },
        
        quant: function ( n, singular, plural, zero ) {
            return ( n === 0 && zero ) ? zero :
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
            return interpolate.apply( string, slice.call( arguments, 1 ) );
        }
    },
    
    /**
        Property: O.Language#translations
        Type: Object.<String,String>

        A map from the string identifier or English string to the localised
        string.
    */
    translations: {},
    
    /**
        Property: O.Language#use24hClock
        Type: Boolean
        
        Should the 24h clock be used?
    */
    use24hClock: true,
    
    /**
        Property: O.Language#dateFormats
        Type: Object.<String,String>
        
        A set of string patterns for dates, in the format used with
        <Date#format>.
    */
    dateFormats: {
        date: '%d/%m/%Y',
        time: function ( date, locale ) {
            return date.format(
                locale.use24hClock ? this.time24 : this.time12 );
        },
        time12: '%-I:%M %p',
        time24: '%H:%M',
        fullDateAndTime: '%A, %-d %B %Y %H:%M',
        shortDayMonth: '%-d %b',
        shortDayMonthYear: '%-d %b ’%y'
    },
    
    /**
        Method: O.Language#translate
        
        Get a localised version of a string.
        
        This method will first look up the string given as its first argument in
        the translations object for this language. If it finds a value it will
        use that, otherwise it will use the original supplied string. The value
        must be either a string or a function. If the value is a function, it
        will be called with the rest of the translate arguments (the values to
        be interpolated) as its arguments. If it is a string, values will be
        interpolated as follows:
        
        Square brackets may be used inside strings to call macros; the syntax is
        the same as for Perl's maketext module. A macro is called like this:
        `[name,_1,arg2,arg3]`. Arguments are passed as literal strings, except
        if it is _n, where n is an integer. In this case, the argument will be
        argument n supplied at runtime to the translation method. To include a
        literal comma or close square bracket, precede it by a tilde. Macros are
        defined in the macro object of the language and will be called with the
        language object as the `this` parameter.
        
        For example, using the default quant macro, you may have the following
        translation string for 'n message(s)':
        
            'Test: [*,_1,directory,directories,No directories] found'
        
        * If you were to call lang.translate( 'n message(s)', 0 ) you would get
          'Test: No directory found' as the output.
        * If you were to call lang.translate( 'n message(s)', 1 ) you would get
          'Test: 1 directory found'
        * If you were to call lang.translate( 'n message(s)', 2 ) you would get
          'Test: 2 directories found'
        
        Parameters:
            string   - {String} The string to localise.
            var_args - {...(String|Number|Object)} The arguments to interpolate.
        
        Returns:
            {String} The localised string.
    */
    translate: function ( string ) {
        var translation = this.translations[ string ],
            compiled, searchIndex,
            start, end, length,
            parts, part, partLength,
            i, j, l;
        
        if ( translation === undefined ) {
            translation = string;
        }
        
        // Compile string
        if ( typeof translation === 'string' ) {
            compiled = '';
            start = 0;
            searchIndex = 0;
            length = translation.length;
            while ( true ) {
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
                    // Invalid translation string. Return literally.
                    if ( end === -1 ) {
                        return string;
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
                    compiled += 'this.macros["';
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
                        compiled += 'arguments';
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
                            compiled += '"].call(this,';
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
            this.translations[ string ] = translation =
                new Function( 'return ' + ( compiled || '""' ) + ';' );
            /*jshint evil: false */
        }
        
        return translation.apply( this, slice.call( arguments, 1 ) );
    },
    
    /**
        Method: O.Language#getFormattedDate
        
        Get a date or time formatted according to local conventions.

        Parameters:
            date - {Date} The date object to format.
            type - {String} The type of result you want, e.g. 'shortDate',
                   'time', 'fullDateAndTime'.
        
        Returns:
            {String} The localised date.
    */
    getFormattedDate: function ( date, type ) {
        var dateFormats = this.dateFormats,
            format = dateFormats[ type ] || dateFormats.date;
        return format instanceof Function ?
            dateFormats[ type ]( date, this ) : date.format( format );
    }
});

/**
    Class: O.Localisation
    
    Alias: O.i18n
    
    This static class has methods for localising strings or dates and for
    registering and setting the user interface language.
*/

/**
    Property (private): O.Localisation-languages
    Type: Object
    
    Stores the loaded <O.Language> instances.
*/
var languages = {
    xx: new Language({ code: 'xx' })
};

/**
    Property (private): O.Localisation-active
    Type: O.Language
    
    The active language.
*/
var active = languages.xx;

var Localisation = {
    /**
        Property: O.Localisation.activeLangCode
        Type: String

        The language code for the active language.
    */
    activeLangCode: 'xx',
    
    /**
        Method: O.Localisation.addLanguage
        
        Registers a resource bundle with the class.
        
        Parameters:
            language - {O.Language} The language instance containing translated
                       strings, date formats etc.
        
        Returns:
            {O.Localisation} Returns self.
    */
    addLanguage: function ( language ) {
        languages[ language.code ] = language;
        return this;
    },
    
    /**
        Method: O.Localisation.setLanguage
        
        Sets a different language as the active one. Will only have an effect if
        the resource bundle for this language has already been loaded and
        registered with a call to addLanguage. Future calls to localise() etc.
        will now use the resources from this language.
        
        Parameters:
            langcode - {String} The code for the language to make active.
        
        Returns:
            {O.Localisation} Returns self.
    */
    setLanguage: function ( langcode ) {
        if ( languages[ langcode ] ) {
            active = languages[ langcode ];
            this.activeLangCode = langcode;
        }
        return this;
    },
    
    /**
        Method: O.Localisation.getLanguage
        
        Returns a previously added language object.
        
        Parameters:
            langcode - {String} The code for the language to fetch.
        
        Returns:
            {Language|null} Returns the language object (null if not present).
    */
    getLanguage: function ( langcode ) {
        return languages[ langcode ] || null;
    },
    
    /**
        Function: O.Localisation.get
        
        Gets a property from the active language.
        
        Parameters:
            key - {String} The name of the property to fetch.
        
        Returns:
            {*} The value for that key.
    */
    get: function ( key ) {
        return active[ key ];
    },
    
    /**
        Function: O.Localisation.localise
        
        Get a localised version of a string.
        
        Alias: O.loc
        
        Parameters:
            text     - {String} The string to localise.
            var_args - {...(String|Number|Object)} The arguments to interpolate.
        
        Returns:
            {String} The localised string.
    */
    localise: function ( text ) {
        if ( arguments.length === 1 ) {
            var translation = active.translations[ text ];
            return translation !== undefined ? translation : text;
        } else {
            return active.translate.apply( active, arguments );
        }
    },
    
    /**
        Function: O.Localisation.date
        
        Get a date or time formatted according to local conventions.
                
        Parameters:
            type - {String} The type of result you want, e.g. 'shortDate',
                   'time', 'fullDateAndTime'.
            date - {...(String|Number|Object)} The arguments to interpolate.
        
        Returns:
            {String} The localised date.
    */
    date: function ( date, type ) {
        return active.getFormattedDate( date, type );
    }
};

NS.Language = Language;
NS.Localisation = NS.i18n = Localisation;
NS.loc = Localisation.localise;

}( O ) );