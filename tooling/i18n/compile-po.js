import parsePo from './parse-po.js';

const flatten = function (output, item) {
    if (item instanceof Array) {
        item.reduce(flatten, output);
    } else {
        output.push(item);
    }
    return output;
};

const divide = function (strings, index) {
    const output = [];
    let l;
    while ((l = strings.length)) {
        const buckets = [];
        let character;
        for (let i = 0; i < l; i += 1) {
            const string = strings[i];
            let ll = buckets.length;
            character = string[index] || '';
            while (ll--) {
                if (buckets[ll].character === character) {
                    buckets[ll].strings.push(string);
                    break;
                }
            }
            if (ll === -1) {
                buckets.push({
                    character,
                    strings: [string],
                });
            }
        }
        if (buckets.length === 1) {
            output.push(character);
            if (!character) {
                break;
            }
            index += 1;
        } else {
            // eslint-disable-next-line no-loop-func
            output.push(buckets.map((bucket) => divide(bucket.strings, index)));
            break;
        }
    }
    return output;
};

const escapeRegExp = function (string) {
    return string.replace(/([-.*+?^${}()|[\]/\\])/g, '\\$1');
};

const join = function (strings) {
    let output = '';
    strings.forEach((part) => {
        if (typeof part === 'string') {
            output += escapeRegExp(part);
        } else {
            const optional = part.some((array) => array[0] === '');
            let section = part
                .filter((array) => !!array[0])
                .map((array) => join(array))
                .join('|');
            if (section.length > 1) {
                section = '(?:' + section + ')';
            }
            if (optional) {
                section += '?';
            }
            output += section;
        }
    });
    return output;
};

const makeRegExp = function (strings) {
    const regexp = join(divide(strings.reduce(flatten, []), 0));
    return '/^' + regexp + '\\b/i';
};

const makePrefixes = function (string) {
    const output = [];
    for (let i = 2, l = string.length; i <= l; i += 1) {
        output.push(string.slice(0, i));
    }
    return output;
};

const ARGUMENT_REGEX = /^a\[\d+\]$/;
const coalesceStringParts = function (parts, part) {
    const end = parts.length - 1;
    if (
        parts.length &&
        !ARGUMENT_REGEX.test(part) &&
        !ARGUMENT_REGEX.test(parts[end])
    ) {
        parts[end] += '+' + part;
    } else {
        parts.push(part);
    }
    return parts;
};

const compileTranslation = function (translation) {
    let compiled = [];
    let start = 0;
    let searchIndex = 0;
    const length = translation.length;

    outer: while (true) {
        let end = translation.indexOf('[', searchIndex);
        // If there are no more macros, just the last text section to process.
        if (end === -1) {
            end = length;
        } else {
            // Check the '[' isn't escaped (preceded by an odd number of
            // '~' characters):
            let j = end;
            while (j--) {
                if (translation[j] !== '~') {
                    break;
                }
            }
            if ((end - j) % 2 === 0) {
                searchIndex = end + 1;
                continue;
            }
        }
        // Standard text section
        const part = translation.slice(start, end).replace(/~(.)/g, '$1');
        if (part) {
            compiled.push(JSON.stringify(part));
        }
        // Check if we've reached the end of the string
        if (end === length) {
            break;
        }
        // Macro section
        let expression = '';
        start = searchIndex = end + 1;
        // Find the end of the macro call.
        while (true) {
            end = translation.indexOf(']', searchIndex);
            // Invalid translation string.
            if (end === -1) {
                compiled = [];
                break outer;
            }
            // Check the ']' character isn't escaped.
            let j = end;
            while (j--) {
                if (translation[j] !== '~') {
                    break;
                }
            }
            if ((end - j) % 2) {
                break;
            }
            searchIndex = end + 1;
        }
        // Split into parts
        const parts = translation.slice(start, end).split(',');
        const l = parts.length;

        if (l > 1) {
            expression += 'x.macros["';
        }
        for (let i = 0; i < l; i += 1) {
            // If not the first part, add a comma to separate the
            // arguments to the macro function call.
            if (i > 1) {
                expression += ',';
            }
            // If a comma was escaped, we split up an argument.
            // Rejoin these.
            let part = parts[i];
            let partLength = part.length;
            while (partLength && part[partLength - 1] === '~') {
                i += 1;
                part += ',';
                part += parts[i];
                partLength = part.length;
            }
            // Unescape the part.
            part = part.replace(/~(.)/g, '$1');
            // Check if we've got an argument.
            if (/^_(?:\*|\d+)$/.test(part)) {
                part = part.slice(1);
                expression += 'a';
                if (part !== '*') {
                    expression += `[${parseInt(part, 10) - 1}]`;
                }
            } else {
                // Otherwise:
                if (!i) {
                    // First part is the macro name.
                    expression += part;
                    expression += '"].call(x,';
                } else {
                    // Anything else is a plain string argument
                    expression += JSON.stringify(part);
                }
            }
        }
        if (l > 1) {
            expression += ')';
        }
        compiled.push(expression);
        start = searchIndex = end + 1;
    }

    compiled = compiled.reduce(coalesceStringParts, []);
    if (compiled.length > 1) {
        compiled = `x._lr([${compiled.join(',')}])`;
    } else {
        compiled = compiled[0];
    }

    return `(x, a) => ${compiled || '""'}`;
};

const makeLocale = function (id, stringIds, idToEntry, outputTranslationsAsFn) {
    const getString = function (id) {
        const obj = idToEntry[id];
        return obj ? obj.translation || obj.string : '';
    };
    let translations;
    if (stringIds) {
        translations = stringIds.map(getString);
        if (outputTranslationsAsFn) {
            translations = translations.map(compileTranslation);
        }
    } else {
        translations = {};
        for (const key in idToEntry) {
            const string = getString(key);
            translations[key] = outputTranslationsAsFn
                ? compileTranslation(string)
                : string;
            // For Overture strings in Vite
            if (outputTranslationsAsFn && !string.startsWith('/')) {
                translations[string] = translations[key];
            }
        }
    }

    return {
        code: id,

        decimalPoint: getString('S_FORMAT_DECIMAL_POINT'),
        thousandsSeparator: getString('S_FORMAT_THOUSANDS_SEPARATOR'),

        fileSizeUnits: [
            getString('SIZE_BYTES'),
            getString('SIZE_KILOBYTES'),
            getString('SIZE_MEGABYTES'),
            getString('SIZE_GIGABYTES'),
        ],

        getFormattedOrdinal: /^en/.test(id)
            ? function (number) {
                  const mod10 = number % 10;
                  const mod100 = number % 100;
                  return (
                      number +
                      (mod10 === 1 && mod100 !== 11
                          ? 'st'
                          : mod10 === 2 && mod100 !== 12
                          ? 'nd'
                          : mod10 === 3 && mod100 !== 13
                          ? 'rd'
                          : 'th')
                  );
              }.toString()
            : id === 'nl'
            ? function (number) {
                  return number + 'e';
              }.toString()
            : undefined,

        dayNames: [
            getString('S_CALENDAR_SUNDAY'),
            getString('S_CALENDAR_MONDAY'),
            getString('S_CALENDAR_TUESDAY'),
            getString('S_CALENDAR_WEDNESDAY'),
            getString('S_CALENDAR_THURSDAY'),
            getString('S_CALENDAR_FRIDAY'),
            getString('S_CALENDAR_SATURDAY'),
        ],

        abbreviatedDayNames: [
            getString('S_CALENDAR_SHORT_HEADER_SUNDAY'),
            getString('S_CALENDAR_SHORT_HEADER_MONDAY'),
            getString('S_CALENDAR_SHORT_HEADER_TUESDAY'),
            getString('S_CALENDAR_SHORT_HEADER_WEDNESDAY'),
            getString('S_CALENDAR_SHORT_HEADER_THURSDAY'),
            getString('S_CALENDAR_SHORT_HEADER_FRIDAY'),
            getString('S_CALENDAR_SHORT_HEADER_SATURDAY'),
        ],

        monthNames: [
            getString('D_JANUARY'),
            getString('D_FEBRUARY'),
            getString('D_MARCH'),
            getString('D_APRIL'),
            getString('D_MAY'),
            getString('D_JUNE'),
            getString('D_JULY'),
            getString('D_AUGUST'),
            getString('D_SEPTEMBER'),
            getString('D_OCTOBER'),
            getString('D_NOVEMBER'),
            getString('D_DECEMBER'),
        ],

        abbreviatedMonthNames: [
            getString('S_CALENDAR_JAN'),
            getString('S_CALENDAR_FEB'),
            getString('S_CALENDAR_MAR'),
            getString('S_CALENDAR_APR'),
            getString('S_CALENDAR_MAY'),
            getString('S_CALENDAR_JUN'),
            getString('S_CALENDAR_JUL'),
            getString('S_CALENDAR_AUG'),
            getString('S_CALENDAR_SEP'),
            getString('S_CALENDAR_OCT'),
            getString('S_CALENDAR_NOV'),
            getString('S_CALENDAR_DEC'),
        ],

        amDesignator: getString('S_CALENDAR_AM'),
        pmDesignator: getString('S_CALENDAR_PM'),

        use24hClock: getString('S_CALENDAR_FORMAT_TIME_DEFAULT') === '24h',

        dateElementOrder: (function () {
            const format = getString('S_CALENDAR_FORMAT_DATE');
            const year = /%-?Y/i.exec(format).index;
            const month = /%-?[mb]/i.exec(format).index;
            const day = /%-?d/i.exec(format).index;
            return year < month && year < day
                ? 'ymd'
                : month < day
                ? 'mdy'
                : 'dmy';
        })(),

        dateFormats: {
            date: getString('S_CALENDAR_FORMAT_DATE'),
            time12: getString('S_CALENDAR_FORMAT_TIME_12'),
            time24: getString('S_CALENDAR_FORMAT_TIME_24'),
            fullDate: getString('S_CALENDAR_FORMAT_FULL_DATE'),
            fullDateAndTime: getString('S_CALENDAR_FORMAT_FULL_DATE_TIME'),
            abbreviatedFullDate: getString('S_CALENDAR_FORMAT_FULL_DATE')
                .replace('%A', '%a')
                .replace('%B', '%b'),
            shortDayMonth: getString('S_CALENDAR_FORMAT_SHORT_DAY_MONTH'),
            shortDayMonthYear: getString(
                'S_CALENDAR_FORMAT_SHORT_DAY_MONTH_YEAR',
            ),
            shortDayDate: getString('S_CALENDAR_FORMAT_SHORT_DAY_DATE'),
            shortMonthYear: getString('S_CALENDAR_FORMAT_SHORT_MONTH_YEAR'),
        },

        datePatterns: {
            jan: makeRegExp([
                makePrefixes(getString('D_JANUARY')),
                getString('S_CALENDAR_JAN'),
            ]),
            feb: makeRegExp([
                makePrefixes(getString('D_FEBRUARY')),
                getString('S_CALENDAR_FEB'),
            ]),
            mar: makeRegExp([
                makePrefixes(getString('D_MARCH')),
                getString('S_CALENDAR_MAR'),
            ]),
            apr: makeRegExp([
                makePrefixes(getString('D_APRIL')),
                getString('S_CALENDAR_APR'),
            ]),
            may: makeRegExp([
                makePrefixes(getString('D_MAY')),
                getString('S_CALENDAR_MAY'),
            ]),
            jun: makeRegExp([
                makePrefixes(getString('D_JUNE')),
                getString('S_CALENDAR_JUN'),
            ]),
            jul: makeRegExp([
                makePrefixes(getString('D_JULY')),
                getString('S_CALENDAR_JUL'),
            ]),
            aug: makeRegExp([
                makePrefixes(getString('D_AUGUST')),
                getString('S_CALENDAR_AUG'),
            ]),
            sep: makeRegExp([
                makePrefixes(getString('D_SEPTEMBER')),
                getString('S_CALENDAR_SEP'),
            ]),
            oct: makeRegExp([
                makePrefixes(getString('D_OCTOBER')),
                getString('S_CALENDAR_OCT'),
            ]),
            nov: makeRegExp([
                makePrefixes(getString('D_NOVEMBER')),
                getString('S_CALENDAR_NOV'),
            ]),
            dec: makeRegExp([
                makePrefixes(getString('D_DECEMBER')),
                getString('S_CALENDAR_DEC'),
            ]),

            mon: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_MONDAY'),
                makePrefixes(getString('S_CALENDAR_MONDAY')),
            ]),
            tue: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_TUESDAY'),
                makePrefixes(getString('S_CALENDAR_TUESDAY')),
            ]),
            wed: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_WEDNESDAY'),
                makePrefixes(getString('S_CALENDAR_WEDNESDAY')),
            ]),
            thu: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_THURSDAY'),
                makePrefixes(getString('S_CALENDAR_THURSDAY')),
            ]),
            fri: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_FRIDAY'),
                makePrefixes(getString('S_CALENDAR_FRIDAY')),
            ]),
            sat: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_SATURDAY'),
                makePrefixes(getString('S_CALENDAR_SATURDAY')),
            ]),
            sun: makeRegExp([
                getString('S_CALENDAR_SHORT_HEADER_SUNDAY'),
                makePrefixes(getString('S_CALENDAR_SUNDAY')),
            ]),

            past: makeRegExp(getString('TIME_PAST_KEYWORDS').split(' ')),
            future: makeRegExp(getString('TIME_FUTURE_KEYWORDS').split(' ')),
            add: makeRegExp([getString('TIME_AFTER'), '+']),
            subtract: makeRegExp([getString('TIME_BEFORE'), '-']),

            yesterday: makeRegExp([getString('TIME_YESTERDAY')]),
            today: makeRegExp([getString('TIME_TODAY')]),
            tomorrow: makeRegExp([getString('TIME_TOMORROW')]),
            now: makeRegExp([getString('TIME_NOW')]),

            // millisecond: '/^ms|milli(?:second)?s?\\b/i',
            // second: '/^sec(?:ond)?s?\\b/i',
            // minute: '/^min(?:ute)?s?\\b/i',
            // hour: '/^h(?:ou)?rs?\\b/i',
            // week: '/^w(?:ee)?k\\b/i',
            // month: '/^m(?:o(?:nth)?s?)?\\b/i',
            // day: '/^d(?:ays?)?\\b/i',
            // year: '/^y(?:(?:ea)?rs?)?\\b/i',

            am: getString('REGEX_DETECT_AM'),
            pm: getString('REGEX_DETECT_PM'),

            ordinalSuffix: getString('REGEX_ORDINAL_SUFFIX'),
            timeContext: getString('REGEX_TIME_CONTEXT'),
        },

        translations,
    };
};

const compile = function (id, code, stringIds, outputTranslationsAsFn = true) {
    const json = parsePo(code);
    const data = makeLocale(id, stringIds, json, outputTranslationsAsFn);
    const generatedCode =
        'export default ' +
        JSON.stringify(data, null, 2)
            .replace(/"(\/.*?\/i?)"/g, function (_, regexp) {
                return regexp.replace(/\\\\/g, '\\');
            })
            .replace(/"function[\s\S]*?}"/g, (fn) =>
                JSON.parse(fn).replace(
                    /function[^(]*(\([^)]*\))\s*/,
                    (_, args) => args.replace(/\s+/g, '') + '=>',
                ),
            );

    return {
        code: generatedCode,
        map: { mappings: '' },
    };
};

export { compile, compileTranslation };
export default compile;
