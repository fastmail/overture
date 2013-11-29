// -------------------------------------------------------------------------- \\
// File: TimeZone.js                                                          \\
// Module: TimeZones                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2013 FastMail Pty Ltd. All rights reserved.                \\
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
        rule, ruleDate, ruleIsUTC, ruleInEffect = null, dateInEffect,
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
            ruleDate = new Date(Date.UTC(
                year, month, date, rule[5], rule[6], rule[7]
            ));
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
                    ruleDate.add(
                        ( ruleIsUTC ? 1 : -1 ) *
                        getRule(
                            rules,
                            offset,
                            new Date( datetime - 86400000 ),
                            isUTC,
                            true
                        )[9], 'second'
                    );
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

var TimeZone = NS.Class({
    init: function ( mixin ) {
        NS.extend( this, mixin );
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

TimeZone.rules = {
    '-': []
};
TimeZone.areas = {};

TimeZone.load = function ( json ) {
    var zones = json.zones,
        link = json.link,
        areas = TimeZone.areas,
        timeZone, id, parts, area, i, l;

    for ( id in zones ) {
        timeZone = new TimeZone({
            id: id,
            periods: zones[ id ]
        });
        TimeZone[ id ] = timeZone;

        area = areas;
        parts = id.replace( /_/g, ' ' ).split( '/' );
        l = parts.length - 1;
        for ( i = 0; i < l; i += 1 ) {
            area = area[ parts[i] ] || ( area[ parts[i] ] = {} );
        }
        area[ parts[l] ] = timeZone;
    }
    for ( id in link ) {
        timeZone = TimeZone[ link[ id ] ];
        TimeZone[ id ] = timeZone;
    }
    NS.extend( TimeZone.rules, json.rules );
};

NS.TimeZone = TimeZone;

}( this.O ) );
