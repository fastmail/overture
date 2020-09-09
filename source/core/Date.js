import { mod } from './Math.js';
import {
    date as localisedDate,
    get as getLocalised,
} from '../localisation/i18n.js';

const isLeapYear = function (year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};
const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// eslint-disable-next-line max-len
const dateFormat = /^(\d{4}|[+-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:Z|(?:([+-])(\d{2})(?::(\d{2}))?)?)?)?$/;

Object.assign(Date, {
    fromJSON(value) {
        /*
            /^
            (\d{4}|[+-]\d{6})       // 1. Year
            (?:
                -(\d{2})            // 2. Month
                (?:
                    -(\d{2})        // 3. Day
                )?
            )?
            (?:
                T(\d{2}):(\d{2})    // 4. Hour : 5. Minutes
                (?:
                    :(\d{2})        // 6. Seconds
                    (?:
                        \.(\d{3})   // 7. Milliseconds
                    )?
                )?
                (?:
                    Z|              // (UTC time)
                    (?:
                        ([+-])      // 8. +/-
                        (\d{2})     // 9. Hours offset
                        (?:
                            :(\d{2}) // 10. Minutes offset
                        )?
                    )?
                )?
            )?$/;
        */
        const results = value ? dateFormat.exec(value) : null;
        return results
            ? new Date(
                  Date.UTC(
                      +results[1] || 0, // Year
                      (+results[2] || 1) - 1, // Month
                      +results[3] || 1, // Day
                      +results[4] || 0, // Hours
                      +results[5] || 0, // Minutes
                      +results[6] || 0, // Seconds
                      +results[7] || 0, // MS
                  ) +
                      (results[8] // Has offset?
                          ? // +- 1 minute in ms
                            (results[8] === '+' ? -1 : 1) *
                            60000 *
                            // Offset in minutes
                            ((+results[9] || 0) * 60 + (+results[10] || 0))
                          : // No offset
                            0),
              )
            : null;
    },

    getDaysInMonth(month, year) {
        return month === 1 && isLeapYear(year) ? 29 : daysInMonths[month];
    },
    getDaysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    },
    isLeapYear,
});

const pad = function (num, nopad, character) {
    return (nopad || num > 9 ? '' : character || '0') + num;
};

const aDay = 86400000; // milliseconds in a day

const duration = {
    second: 1000,
    minute: 60000,
    hour: 3600000,
    day: aDay,
    week: 604800000,
};

Object.assign(Date.prototype, {
    /**
        Method: Date#isToday

        Determines if the point of time represented by the date object is today
        in the current time zone.

        Returns:
            {Boolean} Is the date today?
    */
    isToday(utc) {
        const now = new Date();
        const date = now.getDate();
        const month = now.getMonth();
        const year = now.getFullYear();
        return utc
            ? this.getUTCFullYear() === year &&
                  this.getUTCMonth() === month &&
                  this.getUTCDate() === date
            : this.getFullYear() === year &&
                  this.getMonth() === month &&
                  this.getDate() === date;
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
            {Boolean} Are the dates on the same day?
    */
    isOnSameDayAs(date, utc) {
        return utc
            ? date.getUTCFullYear() === this.getUTCFullYear() &&
                  date.getUTCMonth() === this.getUTCMonth() &&
                  date.getUTCDate() === this.getUTCDate()
            : date.getFullYear() === this.getFullYear() &&
                  date.getMonth() === this.getMonth() &&
                  date.getDate() === this.getDate();
    },

    /**
        Method: Date#getDayName

        Returns the day of the week for this date in the currently active
        locale, provided the Localisation module is loaded. If this isn't
        loaded, it returns the same as Date#getDay().

        Parameters:
            abbreviate - {Boolean} (optional) If true, the method returns an
                         abbreviated day name instead of the full day name.
            utc        - {Boolean} (optional) If true, the UTC time of this date
                         object will be used when determining the day.

        Returns:
            {String} Localised day name.
    */
    getDayName(abbreviate, utc) {
        const names = getLocalised(
            (abbreviate ? 'abbreviatedD' : 'd') + 'ayNames',
        );
        const day = utc ? this.getUTCDay() : this.getDay();
        return names[day];
    },

    /**
        Method: Date#getMonthName

        Returns the month of the year for this date in the currently active
        locale, provided the Localisation module is loaded. If this isn't
        loaded, it returns the same as Date::getMonth().

        Parameters:
            abbreviate - {Boolean} (optional) If true, the method returns an
                         abbreviated month name instead of the full month name.
            utc        - {Boolean} (optional) If true, the UTC time of this date
                         object will be used when determining the day.

        Returns:
            {String} Localised month name.
    */
    getMonthName(abbreviate, utc) {
        const names = getLocalised(
            (abbreviate ? 'abbreviatedM' : 'm') + 'onthNames',
        );
        const day = utc ? this.getUTCMonth() : this.getMonth();
        return names[day];
    },

    /**
        Method: Date#getDayOfYear

        Returns the day of the year for this date, where 1 is the 1st January.

        Parameters:
            utc - {Boolean} (optional) If true, the UTC time of this date object
                  will be used when determining the day.

        Returns:
            {Number} The day of the year (1--366).
    */
    getDayOfYear(utc) {
        const beginningOfYear = utc
            ? Date.UTC(this.getUTCFullYear(), 0, 1)
            : +new Date(this.getFullYear(), 0, 1);
        return ~~((this.getTime() - beginningOfYear) / aDay) + 1;
    },

    /**
        Method: Date#getWeekNumber

        Returns the week of the year for this date, in the range [01,54], given
        the day of the week on which a week starts (default -> Sunday). The
        1st January is always in week 1.

        References:
        https://en.wikipedia.org/wiki/Week#Week_numbering
        https://devblogs.microsoft.com/oldnewthing/20160311-00/?p=93144

        Parameters:
            firstDayOfWeek - {Number} (optional) The day of the week that should
                             be considered the first day of the week.
                             `0` => Sunday (default if none supplied),
                             `1` => Monday etc.
            utc            - {Boolean} (optional) If true, the UTC time of this
                             date object will be used when determining the day.

        Returns:
            {Number} The week of the year (1--54).
    */
    getWeekNumber(firstDayOfWeek, utc) {
        const day = utc ? this.getUTCDay() : this.getDay();
        // 1-indexed day of the year. e.g. 1 Jan => 1
        const dayOfYear = this.getDayOfYear(utc);
        // How many days until the last day of the week. e.g. if the week starts
        // on a Sunday, then Saturday is the last day of the week, so if we
        // are on a Sunday there are 6 days until Saturday, whereas if we are
        // on a Saturday there are 0 days until Saturday.
        const daysUntilEndOfWeek = mod(6 - day + firstDayOfWeek, 7);
        // Week number:
        // 1st Jan => 1 + [0-6] => [1-7] => so divide by 7 and round up for 1.
        // 2nd Jan => 2 + [0-6] => [2-8] => so divide by 7 and round up and will
        // go to 2 only if it is the first day of the week (and so 6 days until)
        // the weekend.
        // etc.
        return Math.ceil((dayOfYear + daysUntilEndOfWeek) / 7);
    },

    /**
        Method: Date#getISOWeekNumber

        Returns the week number of the year (Monday as the first day of the
        week) as a number in the range [01,53]. If the week containing 1 January
        has four or more days in the new year, then it is considered week 1.
        Otherwise, it is the last week of the previous year, and the next week
        is week 1.

        This is how week numbers are defined in ISO 8601.

        Parameters:
            firstDayOfWeek - {Number} (optional) The day of the week that should
                             be considered the first day of the week.
                             `1` => Monday (default if none supplied)
                             `0` => Sunday
                             `6` => Saturday etc.
            utc            - {Boolean} (optional) If true, the UTC time of this
                             date object will be used when determining the day.

        Returns:
            {Number} The week of the year (1--53).
    */
    getISOWeekNumber(firstDayOfWeek, utc) {
        // The week number of the year (Monday as the first day of
        // the week) as a decimal number [01,53]. If the week containing
        // 1 January has four or more days in the new year, then it is
        // considered week 1. Otherwise, it is the last week of the
        // previous year, and the next week is week 1.
        if (firstDayOfWeek == null) {
            firstDayOfWeek = 1;
        }

        // 4th January is always in week 1.
        const jan4 = utc
            ? new Date(Date.UTC(this.getUTCFullYear(), 0, 4))
            : new Date(this.getFullYear(), 0, 4);
        const jan4WeekDay = utc ? jan4.getUTCDay() : jan4.getDay();
        // Find Monday before 4th Jan
        const wk1Start = jan4 - mod(jan4WeekDay - firstDayOfWeek, 7) * aDay;
        // Week No == How many weeks have past since then, + 1.
        let week = Math.floor((this - wk1Start) / 604800000) + 1;
        if (week === 53) {
            const date = utc ? this.getUTCDate() : this.getDate();
            const day = utc ? this.getUTCDay() : this.getDay();
            // First day of week must be no greater than 28th December
            if (date - mod(day - firstDayOfWeek, 7) > 28) {
                week = 1;
            }
        }
        return (
            week ||
            new Date(
                (utc ? this.getUTCFullYear() : this.getFullYear()) - 1,
                11,
                31,
                12,
            ).getISOWeekNumber(firstDayOfWeek, false)
        );
    },

    /**
        Method: Date#add

        Moves the date object forward in time by the given delta.

        Parameters:
            number - {Number} How many days/weeks etc. to move forward.
            unit   - {String} (optional) The unit of the first argument. Must be
                     one of 'second'/minute'/'hour'/'day'/'week'/'month'/'year'.
                     If not supplied, defaults to 'day'.

        Returns:
            {Date} Returns self.
    */
    add(number, unit) {
        if (unit === 'year') {
            this.setFullYear(this.getFullYear() + number);
        } else if (unit === 'month') {
            this.setMonth(this.getMonth() + number);
        } else {
            this.setTime(
                this.getTime() + number * (duration[unit || 'day'] || 0),
            );
        }
        return this;
    },

    /**
        Method: Date#subtract

        Moves the date object backwards in time by the given delta.

        Parameters:
            number - {Number} How many days/weeks etc. to move backwards.
            unit   - {String} (optional) The unit of the first argument. Must be
                     one of 'second'/minute'/'hour'/'day'/'week'/'month'/'year'.
                     If not supplied, defaults to 'day'.

        Returns:
            {Date} Returns self.
    */
    subtract(number, unit) {
        return this.add(-number, unit);
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
        k - Hour of the day in 12h clock (0-23), padded with a space if single
            digit.
        l - Hour of the day in 12h clock (1-12), padded with a space if single
            digit.
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
        z - Timezone offset
        Z - Timezone name or abbreviation.
        % - A '%' character.

        Parameters:
            format - {String} The pattern to use as a template for the string.
            utc    - {Boolean} Use UTC time.

        Returns:
            {String} The formatted date string.
    */
    format(format, utc) {
        const date = this;
        return format
            ? format.replace(/%(-)?([%A-Za-z])/g, function (
                  string,
                  nopad,
                  character,
              ) {
                  switch (character) {
                      case 'a':
                          // Abbreviated day of the week, e.g. 'Mon'.
                          return date.getDayName(true, utc);
                      case 'A':
                          // Full day of the week, e.g. 'Monday'.
                          return date.getDayName(false, utc);
                      case 'b':
                          // Abbreviated month name, e.g. 'Jan'.
                          return date.getMonthName(true, utc);
                      case 'B':
                          // Full month name, e.g. 'January'.
                          return date.getMonthName(false, utc);
                      case 'c':
                          // The locale's appropriate date and time representation.
                          return localisedDate(date, 'fullDateAndTime');
                      case 'C':
                          // Century number (00-99).
                          return pad(
                              ~~(
                                  (utc
                                      ? date.getUTCFullYear()
                                      : date.getFullYear()) / 100
                              ),
                              nopad,
                          );
                      case 'd':
                          // Day of the month (01-31).
                          return pad(
                              utc ? date.getUTCDate() : date.getDate(),
                              nopad,
                          );
                      case 'D':
                          // Same as '%m/%d/%y'
                          return date.format('%m/%d/%y', utc);
                      case 'e':
                          // Day of the month (' 1'-'31'), padded with a space if single
                          // digit.
                          return pad(
                              utc ? date.getUTCDate() : date.getDate(),
                              nopad,
                              ' ',
                          );
                      case 'h':
                          // Same as '%b'.
                          return date.getMonthName(true, utc);
                      case 'H':
                          // Hour of the day in 24h clock (00-23).
                          return pad(
                              utc ? date.getUTCHours() : date.getHours(),
                              nopad,
                          );
                      case 'I': {
                          // Hour of the day in 12h clock (01-12).
                          const num = utc
                              ? date.getUTCHours()
                              : date.getHours();
                          return num
                              ? pad(num < 13 ? num : num - 12, nopad)
                              : '12';
                      }
                      case 'j': {
                          // Day of the year as a decimal number (001-366).
                          const num = date.getDayOfYear(utc);
                          return nopad
                              ? num + ''
                              : num < 100
                              ? '0' + pad(num)
                              : pad(num);
                      }
                      case 'k':
                          // Hour of the day in 12h clock (0-23), padded with a space if
                          // single digit.
                          return pad(
                              utc ? date.getUTCHours() : date.getHours(),
                              nopad,
                              ' ',
                          );
                      case 'l': {
                          // Hour of the day in 12h clock (1-12), padded with a space if
                          // single digit.
                          const num = utc
                              ? date.getUTCHours()
                              : date.getHours();
                          return num
                              ? pad(num < 13 ? num : num - 12, nopad, ' ')
                              : '12';
                      }
                      case 'm':
                          // Month of the year (01-12).
                          return pad(
                              (utc ? date.getUTCMonth() : date.getMonth()) + 1,
                              nopad,
                          );
                      case 'M':
                          // Minute of the hour (00-59).
                          return pad(
                              utc ? date.getUTCMinutes() : date.getMinutes(),
                              nopad,
                          );
                      case 'n':
                          // Newline character.
                          return '\n';
                      case 'p': {
                          // Localised equivalent of AM or PM.
                          const str =
                              (utc ? date.getUTCHours() : date.getHours()) < 12
                                  ? 'am'
                                  : 'pm';
                          return getLocalised(str + 'Designator');
                      }
                      case 'r':
                          // The time in AM/PM notation: '%I:%M:%S %p'.
                          return date.format('%I:%M:%S %p', utc);
                      case 'R':
                          // The time in 24h notation: '%H:%M'.
                          return date.format('%H:%M', utc);
                      case 'S':
                          // The second of the minute (00-61)
                          return pad(
                              utc ? date.getUTCSeconds() : date.getSeconds(),
                              nopad,
                          );
                      case 't':
                          // Tab character.
                          return '\t';
                      case 'T':
                          // The time: '%H:%M:%S'.
                          return date.format('%H:%M:%S', utc);
                      case 'u':
                          // Weekday (1-7) where Monday is 1.
                          return (utc ? date.getUTCDay() : date.getDay()) || 7;
                      case 'U':
                          // The week number of the year (Sunday as the first day of
                          // the week) as a decimal number [00,53]. First Sunday in the
                          // year is the start of week 1.
                          return pad(this.getWeekNumber(0, utc), nopad);
                      case 'V':
                          // The week number of the year (Monday as the first day of
                          // the week) as a decimal number [01,53]. If the week containing
                          // 1 January has four or more days in the new year, then it is
                          // considered week 1. Otherwise, it is the last week of the
                          // previous year, and the next week is week 1.
                          return pad(this.getISOWeekNumber(1, utc), nopad);
                      case 'w':
                          // Weekday (0-6) where Sunday is 0.
                          return utc ? date.getUTCDay() : date.getDay();
                      case 'W':
                          // The week number of the year (Monday as the first day of
                          // the week) as a decimal number [00,53]. All days in a new year
                          // preceding the first Monday are considered to be in week 0.
                          return pad(this.getWeekNumber(1, utc), nopad);
                      case 'x':
                          // The locale's appropriate date representation.
                          return localisedDate(date, 'date');
                      case 'X':
                          // The locale's appropriate time representation.
                          return localisedDate(date, 'time');
                      case 'y':
                          // Year without century (00-99).
                          return (utc
                              ? date.getUTCFullYear()
                              : date.getFullYear()
                          )
                              .toString()
                              .slice(2);
                      case 'Y':
                          // Year with century (0-9999).
                          return utc
                              ? date.getUTCFullYear()
                              : date.getFullYear();
                      case 'z': {
                          // Timezone offset
                          let offset = Math.round(date.getTimezoneOffset());
                          const sign = offset > 0 ? '-' : '+';
                          offset = Math.abs(offset);
                          const hoursOffset = ~~(offset / 60);
                          const minutesOffset = offset - 60 * hoursOffset;
                          return (
                              sign +
                              "%'02n".format(hoursOffset) +
                              ":%'02n".format(minutesOffset)
                          );
                      }
                      case 'Z':
                          // Timezone name or abbreviation.
                          return (
                              /\((.*)\)/.exec(date.toString()) || ['']
                          ).pop();
                      case '%':
                          // A '%' character.
                          return character;
                      default:
                          return string;
                  }
              })
            : this.toString();
    },
});

// TODO(cmorgan/modulify): do something about these exports: Date#fromJSON,
// Date#getDaysInMonth, Date#getDaysInYear, Date#isLeapYear, Date#isToday,
// Date#isOnSameDayAs, Date#getDayName, Date#getMonthName, Date#getDayOfYear,
// Date#getWeekNumber, Date#getISOWeekNumber, Date#add, Date#subtract,
// Date#format
