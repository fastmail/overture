import { escapeRegExp } from '../core/String.js';

// ---

/**
    Module: Localisation

    The Localisation module provides classes for localising an interface.
*/

/**
    Class: O.i18n

    This static class has methods for localising strings or dates and for
    registering and setting the user interface locale.
*/

/**
    Property (private): O.i18n-locales
    Type: Object

    Stores the loaded <O.Locale> instances.
*/
const locales = {};

const alternatives = {
    A: '[Aa\xaa\xc0-\xc5\xe0-\xe5\u0100-\u0105\u01cd\u01ce\u0200-\u0203\u0226\u0227\u1d2c\u1d43\u1e00\u1e01\u1e9a\u1ea0-\u1ea3\u2090\u2100\u2101\u213b\u249c\u24b6\u24d0\u3371-\u3374\u3380-\u3384\u3388\u3389\u33a9-\u33af\u33c2\u33ca\u33df\u33ff\uff21\uff41]',
    B: '[Bb\u1d2e\u1d47\u1e02-\u1e07\u212c\u249d\u24b7\u24d1\u3374\u3385-\u3387\u33c3\u33c8\u33d4\u33dd\uff22\uff42]',
    C: '[Cc\xc7\xe7\u0106-\u010d\u1d9c\u2100\u2102\u2103\u2105\u2106\u212d\u216d\u217d\u249e\u24b8\u24d2\u3376\u3388\u3389\u339d\u33a0\u33a4\u33c4-\u33c7\uff23\uff43]',
    D: '[Dd\u010e\u010f\u01c4-\u01c6\u01f1-\u01f3\u1d30\u1d48\u1e0a-\u1e13\u2145\u2146\u216e\u217e\u249f\u24b9\u24d3\u32cf\u3372\u3377-\u3379\u3397\u33ad-\u33af\u33c5\u33c8\uff24\uff44]',
    E: '[Ee\xc8-\xcb\xe8-\xeb\u0112-\u011b\u0204-\u0207\u0228\u0229\u1d31\u1d49\u1e18-\u1e1b\u1eb8-\u1ebd\u2091\u2121\u212f\u2130\u2147\u24a0\u24ba\u24d4\u3250\u32cd\u32ce\uff25\uff45]',
    F: '[Ff\u1da0\u1e1e\u1e1f\u2109\u2131\u213b\u24a1\u24bb\u24d5\u338a-\u338c\u3399\ufb00-\ufb04\uff26\uff46]',
    G: '[Gg\u011c-\u0123\u01e6\u01e7\u01f4\u01f5\u1d33\u1d4d\u1e20\u1e21\u210a\u24a2\u24bc\u24d6\u32cc\u32cd\u3387\u338d-\u338f\u3393\u33ac\u33c6\u33c9\u33d2\u33ff\uff27\uff47]',
    H: '[Hh\u0124\u0125\u021e\u021f\u02b0\u1d34\u1e22-\u1e2b\u1e96\u210b-\u210e\u24a3\u24bd\u24d7\u32cc\u3371\u3390-\u3394\u33ca\u33cb\u33d7\uff28\uff48]',
    I: '[Ii\xcc-\xcf\xec-\xef\u0128-\u0130\u0132\u0133\u01cf\u01d0\u0208-\u020b\u1d35\u1d62\u1e2c\u1e2d\u1ec8-\u1ecb\u2071\u2110\u2111\u2139\u2148\u2160-\u2163\u2165-\u2168\u216a\u216b\u2170-\u2173\u2175-\u2178\u217a\u217b\u24a4\u24be\u24d8\u337a\u33cc\u33d5\ufb01\ufb03\uff29\uff49]',
    J: '[Jj\u0132-\u0135\u01c7-\u01cc\u01f0\u02b2\u1d36\u2149\u24a5\u24bf\u24d9\u2c7c\uff2a\uff4a]',
    K: '[Kk\u0136\u0137\u01e8\u01e9\u1d37\u1d4f\u1e30-\u1e35\u212a\u24a6\u24c0\u24da\u3384\u3385\u3389\u338f\u3391\u3398\u339e\u33a2\u33a6\u33aa\u33b8\u33be\u33c0\u33c6\u33cd-\u33cf\uff2b\uff4b]',
    L: '[Ll\u0139-\u0140\u01c7-\u01c9\u02e1\u1d38\u1e36\u1e37\u1e3a-\u1e3d\u2112\u2113\u2121\u216c\u217c\u24a7\u24c1\u24db\u32cf\u3388\u3389\u33d0-\u33d3\u33d5\u33d6\u33ff\ufb02\ufb04\uff2c\uff4c]',
    M: '[Mm\u1d39\u1d50\u1e3e-\u1e43\u2120\u2122\u2133\u216f\u217f\u24a8\u24c2\u24dc\u3377-\u3379\u3383\u3386\u338e\u3392\u3396\u3399-\u33a8\u33ab\u33b3\u33b7\u33b9\u33bd\u33bf\u33c1\u33c2\u33ce\u33d0\u33d4-\u33d6\u33d8\u33d9\u33de\u33df\uff2d\uff4d]',
    N: '[Nn\xd1\xf1\u0143-\u0149\u01ca-\u01cc\u01f8\u01f9\u1d3a\u1e44-\u1e4b\u207f\u2115\u2116\u24a9\u24c3\u24dd\u3381\u338b\u339a\u33b1\u33b5\u33bb\u33cc\u33d1\uff2e\uff4e]',
    O: '[Oo\xba\xd2-\xd6\xf2-\xf6\u014c-\u0151\u01a0\u01a1\u01d1\u01d2\u01ea\u01eb\u020c-\u020f\u022e\u022f\u1d3c\u1d52\u1ecc-\u1ecf\u2092\u2105\u2116\u2134\u24aa\u24c4\u24de\u3375\u33c7\u33d2\u33d6\uff2f\uff4f]',
    P: '[Pp\u1d3e\u1d56\u1e54-\u1e57\u2119\u24ab\u24c5\u24df\u3250\u3371\u3376\u3380\u338a\u33a9-\u33ac\u33b0\u33b4\u33ba\u33cb\u33d7-\u33da\uff30\uff50]',
    Q: '[Qq\u211a\u24ac\u24c6\u24e0\u33c3\uff31\uff51]',
    R: '[Rr\u0154-\u0159\u0210-\u0213\u02b3\u1d3f\u1d63\u1e58-\u1e5b\u1e5e\u1e5f\u20a8\u211b-\u211d\u24ad\u24c7\u24e1\u32cd\u3374\u33ad-\u33af\u33da\u33db\uff32\uff52]',
    S: '[Ss\u015a-\u0161\u017f\u0218\u0219\u02e2\u1e60-\u1e63\u20a8\u2101\u2120\u24ae\u24c8\u24e2\u33a7\u33a8\u33ae-\u33b3\u33db\u33dc\ufb06\uff33\uff53]',
    T: '[Tt\u0162-\u0165\u021a\u021b\u1d40\u1d57\u1e6a-\u1e71\u1e97\u2121\u2122\u24af\u24c9\u24e3\u3250\u32cf\u3394\u33cf\ufb05\ufb06\uff34\uff54]',
    U: '[Uu\xd9-\xdc\xf9-\xfc\u0168-\u0173\u01af\u01b0\u01d3\u01d4\u0214-\u0217\u1d41\u1d58\u1d64\u1e72-\u1e77\u1ee4-\u1ee7\u2106\u24b0\u24ca\u24e4\u3373\u337a\uff35\uff55]',
    V: '[Vv\u1d5b\u1d65\u1e7c-\u1e7f\u2163-\u2167\u2173-\u2177\u24b1\u24cb\u24e5\u2c7d\u32ce\u3375\u33b4-\u33b9\u33dc\u33de\uff36\uff56]',
    W: '[Ww\u0174\u0175\u02b7\u1d42\u1e80-\u1e89\u1e98\u24b2\u24cc\u24e6\u33ba-\u33bf\u33dd\uff37\uff57]',
    X: '[Xx\u02e3\u1e8a-\u1e8d\u2093\u213b\u2168-\u216b\u2178-\u217b\u24b3\u24cd\u24e7\u33d3\uff38\uff58]',
    Y: '[Yy\xdd\xfd\xff\u0176-\u0178\u0232\u0233\u02b8\u1e8e\u1e8f\u1e99\u1ef2-\u1ef9\u24b4\u24ce\u24e8\u33c9\uff39\uff59]',
    Z: '[Zz\u0179-\u017e\u01f1-\u01f3\u1dbb\u1e90-\u1e95\u2124\u2128\u24b5\u24cf\u24e9\u3390-\u3394\uff3a\uff5a]',
};

/**
    Property (private): O.i18n-active
    Type: O.Locale

    The active locale.
*/
let active = null;

/**
    Property: O.i18n.activeLocaleCode
    Type: String

    The locale code for the active locale.
*/
let activeLocaleCode = '';

/**
    Method: O.i18n.addLocale

    Registers a resource bundle with the class.

    Parameters:
        locale - {O.Locale} The locale instance containing translated
                    strings, date formats etc.

    Returns:
        {O.i18n} Returns self.
*/
const addLocale = (locale) => {
    locales[locale.code] = locale;
};

/**
    Method: O.i18n.setLocale

    Sets a different locale as the active one. Will only have an effect if
    the resource bundle for this locale has already been loaded and
    registered with a call to addLocale. Future calls to localise() etc.
    will now use the resources from this locale.

    Parameters:
        localeCode - {String} The code for the locale to make active.

    Returns:
        {O.i18n} Returns self.
*/
const setLocale = (localeCode) => {
    if (locales[localeCode]) {
        active = locales[localeCode];
        activeLocaleCode = localeCode;
        if (typeof Intl !== 'undefined') {
            compare = new Intl.Collator(localeCode, {
                sensitivity: 'base',
            }).compare;
        }
    }
};

/**
    Method: O.i18n.getLocale

    Returns a previously added locale object.

    Parameters:
        localeCode - {String} (optional) The code for the locale to return.
                    If not specified, the currently active locale will be
                    returned.

    Returns:
        {Locale|null} Returns the locale object (null if not present).
*/
const getLocale = (localeCode) =>
    localeCode ? locales[localeCode] || null : active;

/**
    Function: O.i18n.get

    Gets a property from the active locale.

    Parameters:
        key - {String} The name of the property to fetch.

    Returns:
        {*} The value for that key.
*/
const get = (key) => active[key];

/**
    Function: O.i18n.localise

    Get a localised version of a string.

    Alias: O.loc

    Parameters:
        text     - {String} The string to localise.
        var_args - {...(String|Number)} The arguments to interpolate.

    Returns:
        {String} The localised string.
*/
const localise = (text, ...args) => {
    const translation = active.translations[text];
    if (translation === undefined) {
        return text;
    }
    return translation(active, args);
};

/**
    Function: O.i18n.localiseList

    Get a localised list of items. The default type is "conjunction", so you
    get "A, B, and C". Change to "disjunction" to get "A, B, or C".

    Parameters:
        items - {String[]} The list of items.
        type  - {String} (optional) "conjunction" or "disjunction".

    Returns:
        {String} The items joined together as a list per locale conventions.
*/
const localiseList = (items, type = 'conjunction') =>
    typeof Intl !== 'undefined' && Intl.ListFormat
        ? new Intl.ListFormat(activeLocaleCode, {
              style: 'short',
              type,
          }).format(items)
        : items.join(', ');

/**
    Function: O.i18n.regionName

    Get the localised region (mostly country) name from the two-letter
    ISO 3166 region code.

    Parameters:
        isoCode - {String} The region code to get the name for.

    Returns:
        {String} The localised region name.
*/
const localiseRegionName = (isoCode) => active.getRegionName(isoCode);

/**
    Function: O.i18n.date

    Get a date or time formatted according to local conventions.

    Parameters:
        date - {...(String|Number|Object)} The arguments to interpolate.
        type - {String} The type of result you want, e.g. 'shortDate',
                'time', 'fullDateAndTime'.
        utc  - {Boolean} (optional) If true, the UTC time of this date
                object will be used when determining the day.

    Returns:
        {String} The localised date.
*/
const localiseDate = (date, type, utc) =>
    active.getFormattedDate(date, type, utc);

/**
    Function: O.i18n.number

    Format a number according to local conventions. Ensures the correct
    symbol is used for a decimal point, and inserts thousands separators if
    used in the locale.

    Parameters:
        n - {(Number|String)} The number to format.

    Returns:
        {String} The localised number.
*/
const localiseNumber = (n) => active.getFormattedNumber(n);

/**
    Function: O.i18n.ordinal

    Format an ordinal number according to local conventions, e.g. "1st",
    "42nd" or "53rd".

    Parameters:
        n - {Number} The number to format.

    Returns:
        {String} The localised ordinal.
*/
const ordinal = (n) => active.getFormattedOrdinal(n);

/**
    Function: O.i18n.fileSize

    Format a number of bytes into a locale-specific file size string.

    Parameters:
        bytes         - {Number} The number of bytes.
        decimalPlaces - {Number} (optional) The number of decimal places to
                        use in the result, if in MB or GB.

    Returns:
        {String} The localised, human-readable file size.
*/
const fileSize = (bytes, decimalPlaces) =>
    active.getFormattedFileSize(bytes, decimalPlaces);

/**
    Function: O.i18n.compare

    Compares two strings in a case-insensitive manner in the custom of the
    current localisation.

    Parameters:
        a - {String} The first string.
        b - {String} The second string.

    Returns:
        {Number}
        `-1` => a is before b,
        `1`  => a is after b,
        `0`  => they are the same as far as this fn is concerned.
*/
let compare = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

/**
    Function: O.i18n.makeSearchRegExp

    Returns a regular expression that tests if another string starts with
    the given string, ignoring case and diacritic differences. e.g. if a
    string "foo" is supplied, the regexp returned would match the string
    "Foøso".

    Basic glob syntax is supported, so the user can type "*" to match zero
    or more characters or "?" to match any single character.

    Spaces are treated as dividing ORed tokens.

    Parameters:
        string - {String} The string to search for.

    Returns: {RegExp} A regular expression that will search for the string.
*/
const makeSearchRegExp = (string) => {
    let anchorToStart = true;
    let source = string.replace(
        /[-.*+?^${}()|[\]/\\ A-Z]/gi,
        (char, index, _string) => {
            switch (char) {
                case '*': {
                    if (!index) {
                        anchorToStart = false;
                        return '';
                    }
                    const next = _string.charAt(index + 1);
                    if (!next) {
                        return '';
                    }
                    return '[^' + escapeRegExp(next) + ']*';
                }
                case '?':
                    return '.';
                case ' ':
                    return '|';
                default:
                    if (/[A-Z]/i.test(char)) {
                        return alternatives[char.toUpperCase()];
                    }
                    return '\\' + char;
            }
        },
    );
    if (anchorToStart) {
        source = '(^|\\W|_)(' + source + ')';
    } else {
        // Ensure 2nd capture group is always the match.
        source = '()(' + source + ')';
    }
    return new RegExp(source, 'i');
};

/**
    Property: O.i18n.letterAlternatives
    Type: String[String]

    Maps upper-case A-Z to a character class string containing all unicode
    alternatives that resemble that letter.
*/
const letterAlternatives = alternatives;

export {
    activeLocaleCode,
    addLocale,
    setLocale,
    getLocale,
    get,
    localise,
    localise as loc,
    localiseList as list,
    localiseRegionName as regionName,
    localiseDate as date,
    localiseNumber as number,
    ordinal,
    fileSize,
    compare,
    makeSearchRegExp,
    letterAlternatives,
};
