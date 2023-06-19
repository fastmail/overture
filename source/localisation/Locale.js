import { merge } from '../core/Core.js';
import { regionNames } from './regionNames.js';

import '../core/Date.js'; // For Date#format

// ---

/*global Intl */

/**
    Class: O.Locale

    Locale packs for use in localisation are created as instances of the
    O.Locale class.
*/
class Locale {
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
    constructor(mixin) {
        this.dateFormats = Object.create(this.dateFormats);
        merge(this, mixin);
        if (
            typeof Intl !== 'undefined' &&
            typeof Intl.DisplayNames !== 'undefined'
        ) {
            const displayNames = new Intl.DisplayNames(this.code, {
                type: 'region',
            });
            this.getRegionName = (isoCode) => {
                if (!isoCode) {
                    return '';
                }
                const name = displayNames.of(isoCode);
                return name === isoCode ? '' : name;
            };
        }
    }
}

Object.assign(Locale.prototype, {
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
        Type: String[]

        An array containing the suffix denoting units of bytes, kilobytes,
        megabytes and gigabytes (in that order).
    */
    fileSizeUnits: ['B', 'KB', 'MB', 'GB'],

    /**
        Method: O.Locale#getFormattedInt

        Format an integer according to local conventions. Inserts thousands
        separators if used in the locale.  Should not be used for fractional
        numbers; use getFormattedNumber instead!

        Parameters:
            number - {(Number|String)} The integer to format.

        Returns:
            {String} The localised number.
    */
    getFormattedInt(number, locale) {
        let string = number + '';
        if (string.length > 3) {
            string = string.replace(
                /(\d+?)(?=(?:\d{3})+$)/g,
                '$1' + locale.thousandsSeparator,
            );
        }
        return string;
    },

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
    getFormattedNumber(number) {
        let integer = number + '';
        let fraction = '';
        const decimalPointIndex = integer.indexOf('.');
        if (decimalPointIndex > -1) {
            fraction = integer.slice(decimalPointIndex + 1);
            integer = integer.slice(0, decimalPointIndex);
        }
        return (
            this.getFormattedInt(integer, this) +
            (fraction && this.decimalPoint + fraction)
        );
    },

    /**
        Method: O.Locale#getFormattedOrdinal

        Format an ordinal number according to local conventions, e.g. "1st",
        "42nd" or "53rd".

        Parameters:
            number - {Number} The number to format.

        Returns:
            {String} The localised ordinal.
    */
    getFormattedOrdinal(number) {
        return number + '.';
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
    getFormattedFileSize(bytes, decimalPlaces) {
        const units = this.fileSizeUnits;
        const l = units.length - 1;
        let i = 0;
        const ORDER_MAGNITUDE = 1000;
        while (i < l && bytes >= ORDER_MAGNITUDE) {
            bytes /= ORDER_MAGNITUDE;
            i += 1;
        }
        // B/KB to nearest whole number, MB/GB to 1 decimal place.
        const number =
            i < 2 ? Math.round(bytes) + '' : bytes.toFixed(decimalPlaces || 0);
        // Use a &nbsp; to join the number to the unit.
        return this.getFormattedNumber(number) + ' ' + units[i];
    },

    // === Date and Time ===

    /**
        Property: O.Locale#dayNames
        Type: String[]

        Names of days of the week, starting from Sunday at index 0.
    */
    dayNames: [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ],
    /**
        Property: O.Locale#abbreviatedDayNames
        Type: String[]

        Abbeviated names of days of the week, starting from Sunday at index 0.
    */
    abbreviatedDayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

    /**
        Property: O.Locale#monthNames
        Type: String[]

        Names of months of the year, starting from January.
    */
    monthNames: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ],

    /**
        Property: O.Locale#abbreviatedMonthNames
        Type: String[]

        Abbeviated names of months of the year, starting from January.
    */
    abbreviatedMonthNames: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ],

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
        Type: String[String]

        A set of string patterns for dates, in the format used with
        <Date#format>.
    */
    dateFormats: {
        date: '%d/%m/%Y',
        time(date, locale, utc) {
            return date.format(
                locale.use24hClock ? this.time24 : this.time12,
                utc,
            );
        },
        time12: '%-I:%M %p',
        time24: '%H:%M',
        fullDate: '%A, %-d %B %Y',
        fullDateAndTime: '%A, %-d %B %Y %H:%M',
        abbreviatedFullDate: '%a, %-d %b %Y',
        shortDayMonth: '%-d %b',
        shortDayMonthYear: '%-d %b ’%y',
    },

    /**
        Property: O.Locale#datePatterns
        Type: String[RegExp]

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
    getFormattedDate(date, type, utc) {
        const dateFormats = this.dateFormats;
        const format = dateFormats[type] || dateFormats.date;
        return typeof format === 'function'
            ? dateFormats[type](date, this, utc)
            : date.format(format, utc);
    },

    // === Strings ===

    /**
        Method: O.Locale#getRegionName

        Get the localised region (mostly country) name from the two-letter
        ISO 3166 region code.

        Parameters:
            isoCode - {String} The region code to get the name for.

        Returns:
            {String} The localised region name.
    */
    getRegionName(isoCode) {
        return regionNames[isoCode] || '';
    },

    /**
        Method (private): Method: O.Locale#_lr

        Accepts a list of translated strings/arguments and, when no DOM
        elements are included in the list, reduces them to a single string.

        Parameters:
            parts - {*[]} Array of items.

        Returns:
            {String|*[]} A single string or array of items.
    */
    _lr(parts) {
        if (parts.some((p) => typeof p === 'object')) {
            return parts;
        }
        return parts.join('');
    },

    /**
        Method: O.Locale#p

        Dynamically constructed at compile time.  Short for "pluralise" — made
        compact for less data to be sent over the wire.

        Given a number and arguments for ICU message syntax options, returns the
        string with the number interpolated using the correct plural noun rules
        for a language.

        An ICUMessageObject has keys in the set {zero, one, two, many, few,
        other}, as appropriate for the locale, as described by Unicode CLDR:
        https://unicode-org.github.io/cldr-staging/charts/latest/supplemental/language_plural_rules.html

        Parameters:
            number        - {Number} The number to insert.
            options       - {ICUMessageObject} The options for a string.

        Returns:
            {String} The localised result string using the correct plural noun.
    */

    /**
        Property: O.Locale#translations
        Type: String[String]

        A map from the string identifier or English string to the localised
        string.
    */
    translations: {},
});

export { Locale };
