// -------------------------------------------------------------------------- \\
// File: DateParser.js                                                        \\
// Module: Parser                                                             \\
// Requires: Localisation, Parse.js                                           \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2014 FastMail Pty Ltd. All rights reserved.                \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

// --- Date Grammar ---

var JUST_TIME = 1,
    JUST_DATE = 2,
    DATE_AND_TIME = 3;

var generateLocalisedDateParser = function ( locale, mode ) {
    var Parse = NS.Parse,
        define = Parse.define,
        optional = Parse.optional,
        not = Parse.not,
        sequence = Parse.sequence,
        firstMatch = Parse.firstMatch,
        longestMatch = Parse.longestMatch;

    var datePatterns = locale.datePatterns;

    var anyInLocale = function ( type, names ) {
        return firstMatch(
            names.split( ' ' ).map( function ( name ) {
                return define( type, datePatterns[ name ], name );
            })
        );
    };

    var whitespace = define( 'whitespace', (/^(?:[\s"']+|$)/) );

    var hours = define( 'hour', /^(?:2[0-3]|[01]?\d)/ ),
        minutes = define( 'minute', /^[0-5][0-9]/ ),
        seconds = define( 'second', /^[0-5][0-9]/ ),
        meridian = firstMatch([
            define( 'am', datePatterns.am ),
            define( 'pm', datePatterns.pm )
        ]),
        timeSuffix = sequence([
            optional( whitespace ),
            meridian
        ]),
        timeDelimiter = define( 'timeDelimiter', ( /^[:.]/ ) ),
        timeContext = define( 'timeContext', datePatterns.timeContext ),
        time = sequence([
            hours,
            optional( sequence([
                timeDelimiter,
                minutes,
                optional( sequence([
                    timeDelimiter,
                    seconds
                ]))
            ])),
            optional(
                timeSuffix
            ),
            whitespace
        ]);

    if ( mode === JUST_TIME ) {
        return firstMatch([
            time,
            sequence([
                hours,
                minutes
            ]),
            whitespace
        ]);
    }

    var ordinalSuffix = define( 'ordinalSuffix', datePatterns.ordinalSuffix ),

        weekday = anyInLocale( 'weekday', 'sun mon tue wed thu fri sat' ),
        day = sequence([
            define( 'day', /^(?:[0-2]\d|3[0-1]|\d)/ ),
            optional( ordinalSuffix ),
            not( timeContext )
        ]),
        monthnumber = sequence([
            define( 'month', /^(?:1[0-2]|0\d|\d)/ ),
            not( firstMatch([
                timeContext,
                ordinalSuffix
            ]))
        ]),
        monthname = anyInLocale( 'monthname',
            'jan feb mar apr may jun jul aug sep oct nov dec' ),
        month = firstMatch([
            monthnumber,
            monthname
        ]),
        fullyear = define( 'year', /^\d{4}/ ),
        year = sequence([
            define( 'year', /^\d\d(?:\d\d)?/ ),
            not( firstMatch([
                timeContext,
                ordinalSuffix
            ]))
        ]),
        searchMethod = anyInLocale( 'searchMethod', 'past future' ),

        dateDelimiter = define( 'dateDelimiter',
            ( /^(?:[\s\-\.\,\'\/]|of)+/ ) ),

        relativeDate = anyInLocale( 'relativeDate',
            'yesterday tomorrow today now' ),

        standardDate = sequence(
            locale.dateFormats.date.split( /%\-?([dmbY])/ ).map(
            function ( part, i ) {
                if ( i & 1 ) {
                    switch ( part ) {
                    case 'd':
                        return day;
                    case 'm':
                        return monthnumber;
                    case 'b':
                        return monthname;
                    case 'Y':
                        return year;
                    }
                } else if ( part ) {
                    return define( 'dateDelimiter',
                        new RegExp( '^' + part.escapeRegExp() )
                    );
                }
                return null;
            }).filter( function ( x ) { return !!x; } )
        ),

        dayMonthYear = sequence([
            day,
            dateDelimiter,
            month,
            dateDelimiter,
            year
        ]),
        dayMonth = sequence([
            day,
            dateDelimiter,
            month
        ]),
        monthYear = sequence([
            month,
            dateDelimiter,
            year,
            not( timeContext )
        ]),
        monthDayYear = sequence([
            month,
            dateDelimiter,
            day,
            dateDelimiter,
            year
        ]),
        monthDay = sequence([
            month,
            dateDelimiter,
            day
        ]),
        yearMonthDay = sequence([
            year,
            dateDelimiter,
            month,
            dateDelimiter,
            day
        ]),
        yearMonth = sequence([
            year,
            dateDelimiter,
            month
        ]),

        date = sequence([
            firstMatch([
                standardDate,
                longestMatch(
                    locale.dateElementOrder === 'dmy' ? [
                        dayMonthYear,
                        dayMonth,
                        monthYear,
                        monthDayYear,
                        monthDay,
                        yearMonthDay,
                        yearMonth
                    ] : locale.dateElementOrder === 'mdy' ?     [
                        monthDayYear,
                        monthDay,
                        monthYear,
                        dayMonthYear,
                        dayMonth,
                        yearMonthDay,
                        yearMonth
                    ] : [
                        yearMonthDay,
                        yearMonth,
                        dayMonthYear,
                        dayMonth,
                        monthYear,
                        monthDayYear,
                        monthDay
                    ]
                )
            ]),
            not( define( '', /^\d/ ) )
        ]);

    if ( mode === JUST_DATE ) {
        return firstMatch([
            date,
            weekday,
            fullyear,
            monthname,
            day,
            relativeDate,
            searchMethod,
            whitespace
        ]);
    }

    return firstMatch([
        date,
        time,
        weekday,
        fullyear,
        monthname,
        day,
        relativeDate,
        searchMethod,
        whitespace
    ]);
};

// --- Interpreter ---

var monthNameToIndex = 'jan feb mar apr may jun jul aug sep oct nov dec'
    .split( ' ' )
    .reduce( function ( monthNameToIndex, name, i ) {
        monthNameToIndex[ name ] = i;
        return monthNameToIndex;
    }, {} );

var dayNameToIndex = 'sun mon tue wed thu fri sat'
    .split( ' ' )
    .reduce( function ( dayNameToIndex, name, i ) {
        dayNameToIndex[ name ] = i;
        return dayNameToIndex;
    }, {} );

var isLeapYear = Date.isLeapYear;
var getDaysInMonth = Date.getDaysInMonth;

var NOW = 0;
var PAST = -1;
var FUTURE = 1;

var interpreter = {
    interpret: function ( tokens, implicitSearchMethod ) {
        var date = {},
            i, l, token, name;
        for ( i = 0, l = tokens.length; i < l; i += 1 ) {
            token = tokens[i];
            name = token[0];
            if ( this[ name ] ) {
                this[ name ]( date, token[1], token[2], tokens );
            }
        }
        return this.findDate( date, date.searchMethod || implicitSearchMethod );
    },
    findDate: function ( constraints, searchMethod ) {
        var keys = Object.keys( constraints );
        if ( !keys.length ) {
            return null;
        }
        var date = new Date(),
            currentDay = date.getDate();

        // If we don't do this, setting month lower down could go wrong,
        // because if the date is 30th and we set month as Feb, we'll end up
        // in March!
        date.setDate( 1 );

        // Time:
        date.setHours( constraints.hour || 0 );
        date.setMinutes( constraints.minute || 0 );
        date.setSeconds( constraints.second || 0 );
        date.setMilliseconds( 0 );

        // Date:
        var day = constraints.day,
            month = constraints.month,
            year = constraints.year,
            weekday = constraints.weekday,

            hasMonth = !!( month || month === 0 ),
            hasWeekday = !!( weekday || weekday === 0 ),

            dayInMs = 86400000,
            currentMonth, isFeb29, delta;

        if ( day && hasMonth && year ) {
            if ( day > getDaysInMonth( month, year ) ) {
                date = null;
            } else {
                date.setFullYear( year );
                date.setMonth( month );
                date.setDate( day );
            }
        } else if ( hasMonth && year ) {
            date.setFullYear( year );
            date.setMonth( month );
            if ( hasWeekday ) {
                if ( searchMethod !== PAST ) {
                    // Date is currently 1.
                    day = ( weekday - date.getDay() ).mod( 7 ) + 1;
                } else {
                    date.setDate( day = getDaysInMonth( month, year ) );
                    day = day - ( date.getDay() - weekday ).mod( 7 );
                }
            } else {
                day = 1;
            }
            date.setDate( day );
        } else if ( day && hasMonth ) {
            currentMonth = date.getMonth();
            year = date.getFullYear();
            // We just use the current year if searchMethod === NOW
            // If it's FUTURE or PAST though, make sure the date conforms to
            // that.
            if ( searchMethod === FUTURE ) {
                if ( month < currentMonth ||
                        ( month === currentMonth && day <= currentDay ) ) {
                    year += 1;
                }
            }
            if ( searchMethod === PAST ) {
                if ( month > currentMonth ||
                        ( month === currentMonth && day >= currentDay ) ) {
                    year -= 1;
                }
            }
            date.setFullYear( year );
            date.setMonth( month );
            date.setDate( day );
            // If we have a weekday constraint, iterate in the past or future
            // direction until we find a year where that matches.
            if ( hasWeekday ) {
                isFeb29 = ( day === 29 && month === 1 );
                if ( isFeb29 ) {
                    while ( !isLeapYear( year ) ) {
                        year += ( searchMethod || 1 );
                    }
                    date.setFullYear( year );
                }
                delta = ( isFeb29 ? 4 : 1 ) * ( searchMethod || 1 ) ;
                while ( date.getDay() !== weekday ) {
                    do {
                        year += delta;
                    } while ( isFeb29 && !isLeapYear( year ) );
                    date.setFullYear( year );
                }
            }
        } else if ( day ) {
            year = date.getFullYear();
            month = date.getMonth();
            date.setDate( day );
            if ( hasWeekday ) {
                // Find month which satisfies this.
                while ( date.getDay() !== weekday || date.getDate() !== day ) {
                    if ( searchMethod === PAST ) {
                        if ( month ) {
                            month -= 1;
                        } else {
                            year -= 1;
                            month = 11;
                        }
                    } else {
                        if ( month < 11 ) {
                            month += 1;
                        } else {
                            year += 1;
                            month = 0;
                        }
                    }
                    date.setFullYear( year );
                    date.setMonth( month );
                    date.setDate( day );
                }
            }
        } else if ( hasMonth ) {
            year = date.getFullYear();
            currentMonth = date.getMonth();
            // We just use the current year if searchMethod === NOW
            // If it's FUTURE or PAST though, make sure the date conforms to
            // that.
            if ( searchMethod === FUTURE && month <= currentMonth ) {
                year += 1;
            }
            if ( searchMethod === PAST && month > currentMonth ) {
                year -= 1;
            }
            date.setFullYear( year );
            date.setMonth( month );

            if ( hasWeekday ) {
                if ( searchMethod !== PAST ) {
                    day = ( weekday - date.getDay() ).mod( 7 ) + 1;
                } else {
                    date.setDate( day = getDaysInMonth( month, year ) );
                    day = day - ( date.getDay() - weekday ).mod( 7 );
                }
                date.setDate( day );
            }
        } else if ( year ) {
            date.setFullYear( year );
            date.setMonth( 0 );
            if ( hasWeekday ) {
                if ( searchMethod !== PAST ) {
                    day = ( weekday - date.getDay() ).mod( 7 ) + 1;
                } else {
                    date.setMonth( 11 );
                    date.setDate( day = getDaysInMonth( 11, year ) );
                    day = day - ( date.getDay() - weekday ).mod( 7 );
                }
                date.setDate( day );
            }
        } else if ( hasWeekday ) {
            date.setDate( currentDay );
            if ( searchMethod === PAST ) {
                date.setTime( date.getTime() - dayInMs );
                date.setTime( date.getTime() -
                    ( dayInMs * ( date.getDay() - weekday ).mod( 7 ) ) );
            } else {
                date.setTime( date.getTime() + dayInMs );
                date.setTime( date.getTime() +
                    ( dayInMs * ( weekday - date.getDay() ).mod( 7 ) ) );
            }
        }

        return date;
    },

    weekday: function ( date, string, weekday ) {
        date.weekday = dayNameToIndex[ weekday ];
    },
    day: function ( date, string ) {
        date.day = +string;
    },
    month: function ( date, string ) {
        date.month = +string - 1;
    },
    monthname: function ( date, string, name ) {
        date.month = monthNameToIndex[ name ];
    },
    year: function ( date, string ) {
        var year = +string;
        if ( string.length === 2 ) {
            year += 2000;
            if ( year > new Date().getFullYear() + 30 ) {
                year -= 100;
            }
        }
        date.year = year;
    },
    hour: function ( date, string ) {
        date.hour = +string;
        var meridian = date.meridian;
        if ( meridian ) {
            this[ meridian ]( date );
        }
    },
    minute: function ( date, string ) {
        date.minute = +string;
    },
    second: function ( date, string ) {
        date.second = +string;
    },
    am: function ( date ) {
        date.meridian = 'am';
        var hour = date.hour;
        if ( hour && hour === 12 ) {
            date.hour = 0;
        }
    },
    pm: function ( date ) {
        date.meridian = 'pm';
        var hour = date.hour;
        if ( hour && hour < 12 ) {
            date.hour = hour + 12;
        }
    },
    searchMethod: function ( date, string, pastOrFuture ) {
        date.searchMethod = ( pastOrFuture === 'past' ) ? PAST : FUTURE;
    },
    relativeDate: function ( date, string, context ) {
        var now = new Date(),
            dayInMs = 86400000;
        switch ( context ) {
            case 'yesterday':
                now.setTime( now.getTime() - dayInMs );
                break;
            case 'tomorrow':
                now.setTime( now.getTime() + dayInMs );
                break;
        }
        date.day = now.getDate();
        date.month = now.getMonth();
        date.year = now.getFullYear();
    }
};

// ---

var unknown = NS.Parse.define( 'unknown', /^[^\s]+/ );

var dateParsers = {};
var parseDateTime = function ( string, locale, mode ) {
    if ( !locale ) {
        locale = NS.i18n.getLocale();
    }
    var code = locale.code + mode;
    var dateParser = dateParsers[ code ] ||
        ( dateParsers[ code ] = generateLocalisedDateParser( locale, mode ) );
    var parse = new NS.Parse( string.trim() );
    while ( parse.string.length ) {
        if ( !dateParser( parse ) ) {
            // We've hit something unexpected. Skip it.
            unknown( parse );
        }
    }
    return parse.tokens;
};

NS.parse.tokeniseDateTime = parseDateTime;
NS.parse.interpretDateTime = function ( tokens, implicitSearchMethod ) {
    return interpreter.interpret( tokens, implicitSearchMethod || NOW );
};

NS.parse.time = function ( string, locale ) {
    var tokens = parseDateTime( string, locale, JUST_TIME );
    return interpreter.interpret( tokens );
};

NS.parse.date = function ( string, locale, implicitPast ) {
    var tokens = parseDateTime( string, locale, JUST_DATE );
    return interpreter.interpret( tokens, implicitPast ? PAST : NOW );
};

NS.parse.dateTime = function ( string, locale, implicitPast ) {
    var tokens = parseDateTime( string, locale, DATE_AND_TIME );
    return interpreter.interpret( tokens, implicitPast ? PAST : NOW );
};

}( this.O ) );
