// -------------------------------------------------------------------------- \\
// File: Date.js                                                              \\
// Module: Core                                                               \\
// Requires: Core.js                                                          \\
// Author: Neil Jenkins                                                       \\
// License: © 2010–2011 Opera Software ASA. All rights reserved.              \\
// -------------------------------------------------------------------------- \\

/*global O */

"use strict";

( function () {

Date.extend({
    /**
        Function: Date.now
        
        ECMAScript 5 Date.now method. Returns the current time as the number of
        milliseconds since 1 January 1970.
        
        Returns:
            {Number} The current time.
    */
    now: function () {
        return +( new Date() );
    }
});

var pad = function ( num, nopad, character ) {
    return ( nopad || num > 9 ) ? num : ( character || '0' ) + num;
};

Date.implement({
    /**
        Method: Date#isToday
        
        Determines if the point of time represented by the date object is today
        in the current time zone.
        
        Returns:
            {Boolean} Is the date today?
    */
    isToday: function () {
        return this.isOnSameDayAs( new Date() );
    },
    
    /**
        Method: Date#isOnSameDayAs
        
        Determines if the two points of time are on the same day. Each date is
        considered in its local time zone, e.g. 10pm GMT on 1/1/2010 would be
        considered the same day as 10pm EST on 1/1/2010, although these are
        different dates if the dates are first converted to the same timezone.
        
        Parameters:
            date - {Date} Date to compare it to.
        
        Returns:
            {Boolean} Is the date today?
    */
    isOnSameDayAs: function ( date ) {
        var aDay = 86400000; // milliseconds in a day
        return ~~( ( date - ( date.getTimezoneOffset() * 60000 ) ) / aDay ) ===
               ~~( ( this - ( this.getTimezoneOffset() * 60000 ) ) / aDay );
    },
    
    /**
        Method: Date#getDayName
        
        Returns the day of the week for this date in the currently active
        language, provided the Localisation module is loaded. If this isn't
        loaded, it returns the same as Date#getDay().
        
        Parameters:
            abbreviate - {Boolean} If true, the method returns an abbreviated
                         day name instead of the full day name.
        
        Returns:
            {String} Localised day name.
    */
    getDayName: function ( abbreviate ) {
        var names = O && O.i18n && O.i18n.get(
                ( abbreviate ? 'abbreviatedD' : 'd' ) + 'ayNames' ),
            day = this.getDay();
        return names ? names[ day ] : day;
    },
    
    /**
        Method: Date#getMonthName
        
        Returns the month of the year for this date in the currently active
        language, provided the Localisation module is loaded. If this isn't
        loaded, it returns the same as Date::getMonth().
        
        Parameters:
            abbreviate - {Boolean} If true, the method returns an abbreviated
                         month name instead of the full month name.
        
        Returns:
            {String} Localised month name.
    */
    getMonthName: function ( abbreviate) {
        var names = O && O.i18n && O.i18n.get(
                ( abbreviate ? 'abbreviatedM' : 'm' ) + 'onthNames' ),
            day = this.getMonth();
        return names ? names[ day ] : day;
    },
    
    /**
        Method: Date#getDayOfYear
        
        Returns the day of the year for this date, where 1 is the 1st January.
        
        Returns:
            {Number} The day of the year (1--366).
    */
    getDayOfYear: function () {
        var beginningOfYear = new Date( this.getFullYear(), 0, 1 );
        // 86400000 = milliseconds in a day = 24 * 60 * 60 * 1000
        return ~~( ( this - beginningOfYear ) / 86400000 ) + 1;
    },
    
    /**
        Method: Date#format
        
        Formats the date as a string, according to the format pattern given.
        A variable to be substituted starts with a %, then optionally a '-'
        to stop it from being 0-padded to a fixed length (if applicable),
        then a character to indicate the desired part of the date. All patterns
        defined in strftime format are supported
        (http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html).
        
        a - Abbreviated day of the week, e.g. 'Mon'.
        A - Full day of the week, e.g. 'Monday'.
        b - Abbreviated month name, e.g. 'Jan'.
        B - Full month name, e.g. 'January'.
        c - The locale's appropriate date and time representation.
        C - Century number (00-99).
        d - Day of the month (01-31).
        D - Same as '%m/%d/%y'.
        e - Day of the month (' 1'-'31'), padded with a space if single digit.
        h - Same as '%b'.
        H - Hour of the day in 24h clock (00-23).
        I - Hour of the day in 12h clock (01-12).
        j - Day of the year as a decimal number (001-366).
        m - Month of the year (01-12).
        M - Minute of the hour (00-59).
        n - Newline character.
        p - Localised equivalent of AM or PM.
        r - The time in AM/PM notation: '%I:%M:%S %p'.
        R - The time in 24h notation: '%H:%M'.
        S - The second of the minute (00-61).
        t - Tab character.
        T - The time: '%H:%M:%S'.
        u - Weekday (1-7) where Monday is 1.
        U - The week number of the year (Sunday as the first day of the week) as
            a decimal number (00-53). The first Sunday in the year is the start
            of week 1, any day before this in the year is in week 0.
        V - The week number of the year (Monday as the first day of the week) as
            a decimal number (01-53). If the week containing 1 January has four
            or more days in the new year, then it is considered week 1.
            Otherwise, it is the last week of the previous year, and the next
            week is week 1.
        w - Weekday (0-6) where Sunday is 0.
        W - The week number of the year (Monday as the first day of the week) as
            a decimal number (00-53). All days in a new year preceding the first
            Monday are considered to be in week 0.
        x - The locale's appropriate date representation.
        X - The locale's appropriate time representation.
        y - Year without century (00-99).
        Y - Year with century (0-9999)
        Z - Timezone name or abbreviation.
        % - A '%' character.
        
        Parameters:
            format - {String} The pattern to use as a template for the string.
        
        Returns:
            {String} The formatted date string.
    */
    format: function ( format ) {
        var date = this;
        return format ?
            format.replace(/%(\-)?([%A-Za-z])/g,
                function ( string, nopad, character ) {
            var num, str;
            switch ( character ) {
            case 'a':
                // Abbreviated day of the week, e.g. 'Mon'.
                return date.getDayName( true );
            case 'A':
                // Full day of the week, e.g. 'Monday'.
                return date.getDayName();
            case 'b':
                // Abbreviated month name, e.g. 'Jan'.
                return date.getMonthName( true );
            case 'B':
                // Full month name, e.g. 'January'.
                return date.getMonthName();
            case 'c':
                // The locale's appropriate date and time representation.
                return ( O && O.i18n ) ?
                    O.i18n.date( date, 'fullDateAndTime' ) :
                    date.toLocaleString();
            case 'C':
                // Century number (00-99).
                return pad( ~~( date.getFullYear() / 100 ), nopad );
            case 'd':
                // Day of the month (01-31).
                return pad( date.getDate(), nopad );
            case 'D':
                // Same as '%m/%d/%y'
                return date.format( '%m/%d/%y' );
            case 'e':
                // Day of the month (' 1'-'31'), padded with a space if single
                // digit.
                return pad( date.getDate(), nopad, ' ' );
            case 'h':
                // Same as '%b'.
                return date.getMonthName( true );
            case 'H':
                // Hour of the day in 24h clock (00-23).
                return pad( date.getHours(), nopad );
            case 'I':
                // Hour of the day in 12h clock (01-12).
                num = date.getHours();
                return num ? pad( num < 13 ? num : num - 12, nopad ) : 12;
            case 'j':
                // Day of the year as a decimal number (001-366).
                num = date.getDayOfYear();
                return nopad ? num : num < 100 ? '0' + pad( num ) : pad( num );
            case 'm':
                // Month of the year (01-12).
                return pad( ( date.getMonth() + 1 ), nopad );
            case 'M':
                // Minute of the hour (00-59).
                return pad( date.getMinutes(), nopad );
            case 'n':
                // Newline character.
                return '\n';
            case 'p':
                // Localised equivalent of AM or PM.
                str = date.getHours() < 12 ? 'am' : 'pm';
                return ( O && O.i18n ) ?
                    O.i18n.get( str + 'Designator' ) : str.toUpperCase();
            case 'r':
                // The time in AM/PM notation: '%I:%M:%S %p'.
                return date.format( '%I:%M:%S %p' );
            case 'R':
                // The time in 24h notation: '%H:%M'.
                return date.format( '%H:%M' );
            case 'S':
                // The second of the minute (00-61)
                return pad( date.getSeconds(), nopad );
            case 't':
                // Tab character.
                return '\t';
            case 'T':
                // The time: '%H:%M:%S'.
                return date.format( '%H:%M:%S' );
            case 'u':
                // Weekday (1-7) where Monday is 1.
                return date.getDay() || 7;
            case 'U':
                // The week number of the year (Sunday as the first day of
                // the week) as a decimal number [00,53]. First Sunday in the
                // year is the start of week 1.
                return pad(
                    ~~( ( date.getDayOfYear() - 1 ) + // Day of the year 0-index
                        ( 7 - date.getDay() ) // Days to next Sunday
                      ) / 7, nopad );
            case 'V':
                // The week number of the year (Monday as the first day of
                // the week) as a decimal number [01,53]. If the week containing
                // 1 January has four or more days in the new year, then it is
                // considered week 1. Otherwise, it is the last week of the
                // previous year, and the next week is week 1.
                var beginningOfYear = new Date( date.getFullYear(), 0, 1 ),
                    offset = ( ( beginningOfYear.getDay() + 2 ) % 7 ) + 3,
                    week = ~~( ( date.getDayOfYear() + offset ) / 7 );
                return week ? pad( week, nopad ) :
                    new Date( date.getFullYear() - 1, 11, 31 ).format( string );
            case 'w':
                // Weekday (0-6) where Sunday is 0.
                return date.getDay();
            case 'W':
                // The week number of the year (Monday as the first day of
                // the week) as a decimal number [00,53]. All days in a new year
                // preceding the first Monday are considered to be in week 0.
                return pad(
                    ~~( ( date.getDayOfYear() - 1 ) + // Day of the year 0-index
                        ( 8 - ( date.getDay() || 7 ) ) // Days to next Monday
                      ) / 7, nopad );
            case 'x':
                // The locale's appropriate date representation.
                return ( O && O.i18n ) ?
                    O.i18n.date( date, 'date' ) :
                    date.format( '%d/%m/%y' );
            case 'X':
                // The locale's appropriate time representation.
                return ( O && O.i18n ) ?
                    O.i18n.date( date, 'time' ) :
                    date.format( '%H:%M' );
            case 'y':
                // Year without century (00-99).
                return date.getFullYear().toString().slice( 2 );
            case 'Y':
                // Year with century (0-9999).
                return date.getFullYear();
            case 'Z':
                // Timezone name or abbreviation.
                return ( /\((.*)\)/.exec( date.toString() ) || [ '' ] ).pop();
            case '%':
                // A '%' character.
                return character;
            default:
                return string;
            }
        }) : this.toString();
    }
});

}() );