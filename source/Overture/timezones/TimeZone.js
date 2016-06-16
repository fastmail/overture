// -------------------------------------------------------------------------- \\
// File: TimeZone.js                                                          \\
// Module: TimeZones                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

// Periods format:
// until posix time, offset (secs), rules name, suffix
// e.g. [ +new Date(), -3600, 'EU', 'CE%sT' ]

var getPeriod = function ( periods, date, isUTC ) {
    var l = periods.length - 1,
        period, candidate;
    period = periods[l];
    while ( l-- ) {
        candidate = periods[l];
        if ( candidate[0] < date - ( isUTC ? 0 : candidate[1] ) ) {
            break;
        }
        period = candidate;
    }
    return period;
};

// Rules format:
// start year, end year, month, date, day, hour, minute, second,
//      utc=0/local=1/wall=2, offset (secs), suffix ]
// e.g. [ 1987, 2006, 4, 3, 0, 0, 2, 0, 2, 3600, 'BST' ]

var getRule = function ( rules, offset, datetime, isUTC, recurse ) {
    var l = rules.length,
        year = datetime.getUTCFullYear(),
        ruleInEffect = null,
        rule, ruleDate, ruleIsUTC, prevRule, dateInEffect,
        month, date, day, difference;
    while ( l-- ) {
        rule = rules[l];
        // Sorted by end year. So if ends before this date, no further rules
        // can apply.
        if ( rule[1] < year ) {
            break;
        }
        // If starts on or before this date, the rule applies.
        if ( rule[0] <= year ) {
            // Create the date object representing the transition point.
            month = rule[2];
            // 0 => last day of the month
            date = rule[3] || Date.getDaysInMonth( month, year );
            ruleDate = new Date(Date.UTC( year, month, date ));

            // Adjust to nearest +/- day of the week if specified
            if ( day = rule[4] ) {
                // +/- => (on or after/on or before) current date.
                // abs( value ) => 1=SUN,2=MON,... etc.
                difference =
                    ( Math.abs( day ) - ruleDate.getUTCDay() + 6 ) % 7;
                if ( difference ) {
                    ruleDate.add(
                        day < 1 ? difference - 7 : difference
                    );
                }
            }

            // Set time (could be 24:00, which moves it to next day)
            ruleDate.setUTCHours( rule[5] );
            ruleDate.setUTCMinutes( rule[6] );
            ruleDate.setUTCSeconds( rule[7] );

            // Now match up timezones
            ruleIsUTC = !rule[8];
            if ( ruleIsUTC !== isUTC ) {
                ruleDate.add(
                    ( ruleIsUTC ? 1 : -1 ) * offset, 'second'
                );
                // We need to add the offset of the previous rule. Sigh.
                // The maximum time offset from a rule is 2 hours. So if within
                // 3 hours, find the rule for the previous day.
                if ( rule[8] === 2 &&
                    Math.abs( ruleDate - datetime ) <= 3 * 60 * 60 * 1000 ) {
                    prevRule = getRule(
                        rules,
                        offset,
                        new Date( datetime - 86400000 ),
                        isUTC,
                        true
                    );
                    if ( prevRule ) {
                        ruleDate.add(
                            ( ruleIsUTC ? 1 : -1 ) * prevRule[9], 'second'
                        );
                    }
                }
            }

            // If we're converting from UTC, the time could be valid twice
            // or invalid. We should pick the rule to follow RFC5545 guidance:
            // Presume the earlier rule is still in effect in both cases
            if ( !isUTC ) {
                ruleDate.add( rule[9], 'second' );
                if ( Math.abs( ruleDate - datetime ) <= 3 * 60 * 60 * 1000 ) {
                    prevRule = prevRule || getRule(
                        rules,
                        offset,
                        new Date( datetime - 86400000 ),
                        isUTC,
                        true
                    );
                    if ( prevRule ) {
                        ruleDate.add( prevRule[9], 'second' );
                    }
                }
            }

            // Does this replace a previously found rule?
            if ( ruleDate <= datetime &&
                    ( !dateInEffect || ruleDate > dateInEffect ) ) {
                ruleInEffect = rule;
                dateInEffect = ruleDate;
            }
        }
    }
    if ( !ruleInEffect && recurse ) {
        return getRule( rules, offset, new Date(Date.UTC(
            year - 1, 11, 31, 12, 0, 0
        )), isUTC, false );
    }
    return ruleInEffect;
};

var switchSign = function ( string ) {
    return string.replace( /[+-]/, function ( sign ) {
        return sign === '+' ? '-' : '+';
    });
};

var TimeZone = NS.Class({
    init: function ( id, periods ) {
        var name = id.replace( /_/g, ' ' );
        // The IANA ids have the +/- the wrong way round for historical reasons.
        // Display correctly for the user in name and suffix.
        if ( /GMT[+-]/.test( name ) ) {
            name = switchSign( name );
            periods[0][3] = switchSign( periods[0][3] );
        }

        this.id = id;
        this.name = name;
        this.periods = periods;
    },

    convert: function ( date, toTimeZone ) {
        var period = getPeriod( this.periods, date ),
            offset = period[1],
            rule = getRule( TimeZone.rules[ period[2] ] || [],
                offset, date, toTimeZone, true );
        if ( rule ) {
            offset += rule[9];
        }
        if ( !toTimeZone ) {
            offset = -offset;
        }
        return new Date( +date + offset * 1000 );
    },
    convertDateToUTC: function ( date ) {
        return this.convert( date, false );
    },
    convertDateToTimeZone: function ( date ) {
        return this.convert( date, true );
    },
    getSuffix: function ( date ) {
        var period = getPeriod( this.periods, date, false ),
            offset = period[1],
            rule = getRule( TimeZone.rules[ period[2] ],
                offset, date, false, true ),
            suffix = period[3],
            slashIndex = suffix.indexOf( '/' );
        // If there's a slash, e.g. "GMT/BST", presume first if no time offset,
        // second if time offset.
        if ( rule && slashIndex > - 1 ) {
            suffix = rule[9] ?
                suffix.slice( slashIndex + 1 ) : suffix.slice( 0, slashIndex );
            rule = null;
        }
        return suffix.format( rule ? rule[10] : '' );
    },
    toJSON: function () {
        return this.id;
    }
});

TimeZone.fromJSON = function ( id ) {
    return TimeZone[ id ] || TimeZone.UTC;
};

TimeZone.isEqual = function ( a, b ) {
    return a.id === b.id;
};

var addTimeZone = function ( timeZone ) {
    var area = TimeZone.areas;
    var parts = timeZone.name.split( '/' );
    var l = parts.length - 1;
    var i;
    for ( i = 0; i < l; i += 1 ) {
        area = area[ parts[i] ] || ( area[ parts[i] ] = {} );
    }
    area[ parts[l] ] = timeZone;

    TimeZone[ timeZone.id ] = timeZone;
};

TimeZone.rules = {
    '-': []
};
TimeZone.areas = {};

TimeZone.load = function ( json ) {
    var zones = json.zones,
        link = json.link,
        id;

    for ( id in zones ) {
        addTimeZone( new TimeZone( id, zones[ id ] ) );
    }
    for ( id in link ) {
        addTimeZone( new TimeZone( id, zones[ link[ id ] ] ) );
    }
    NS.extend( TimeZone.rules, json.rules );
};

NS.TimeZone = TimeZone;

}( O ) );
