/*global require, process, console */

'use strict';

const fs = require('fs');
const prettier = require('prettier');

const isId = /^[A-Z0-9_]+$/;

// DB Tools

const parseDb = function (text) {
    return JSON.parse(text);
};

const parseLang = function (text) {
    // eslint-disable-next-line no-eval
    return eval(
        text.replace('export default ', '(function () {return ') + '})();',
    );
};

const stringify = function (db) {
    return prettier.format(
        `/* eslint-disable import/no-default-export */\nexport default ${JSON.stringify(
            db,
        )}`,
        {
            tabWidth: 4,
            parser: 'babel',
        },
    );
};

const indexDB = function (db, property) {
    const output = {};
    Object.keys(db).forEach((key) => (output[key] = db[key][property]));
    return output;
};

// Enumeration and extraction

const locExtractor = /\bloc\(\s*'(.*?)'/g;
const usesExtractor = /\b(loc|getString)\(\s*'(.*?)'/g;

const indexFor = function (array, number) {
    let max = array.length;
    let min = 0;

    while (min + 1 < max) {
        const mid = (min + max) >> 1;
        if (number >= array[mid]) {
            min = mid;
        } else {
            max = mid;
        }
    }

    return min;
};

const enumerate = function (
    fileName,
    stringToEntry,
    textToScan,
    seen,
    ids,
    widenSearch,
) {
    const extractor = widenSearch ? usesExtractor : locExtractor;
    const lines = textToScan.split('\n').reduce((array, line) => {
        let length = line.length;
        const arrayLength = array.length;
        if (arrayLength) {
            length += array[arrayLength - 1] + 1;
        }
        array[arrayLength] = length;
        return array;
    }, []);
    let match;
    extractor.lastIndex = 0;
    while ((match = extractor.exec(textToScan))) {
        let id = match[1];
        if (!isId.test(id)) {
            if (!stringToEntry[id]) {
                console.log(id);
            }
            id = stringToEntry[id].id;
        }
        const lineNumber = indexFor(lines, match.index);
        if (!seen[id]) {
            ids.push(id);
            seen[id] = {
                count: 1,
                uses: [fileName + ':' + lineNumber],
            };
        } else {
            seen[id].count += 1;
            seen[id].uses.push(fileName + ':' + lineNumber);
        }
    }
};

const extract = function (dbFilePath, filesToScanPaths, outputPath, allData) {
    fs.readFile(dbFilePath, 'utf8', (error, dbText) => {
        if (error) {
            console.log('Could not read dbFile');
            return;
        }
        const db = parseDb(dbText);
        const stringToEntry = indexDB(db, 'string');
        const seen = {};
        const ids = [];
        filesToScanPaths.forEach((filePath) => {
            const textToScan = fs.readFileSync(filePath, 'utf8');
            const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
            enumerate(fileName, stringToEntry, textToScan, seen, ids);
        });
        ids.sort();
        fs.writeFileSync(outputPath, JSON.stringify(allData ? seen : ids));
    });
};

// Lang module

const makePrefixes = function (string) {
    const output = [];
    for (let i = 2, l = string.length; i <= l; i += 1) {
        output.push(string.slice(0, i));
    }
    return output;
};

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
    let string;
    let character;
    while ((l = strings.length)) {
        const buckets = [];
        for (let i = 0; i < l; i += 1) {
            string = strings[i];
            character = string[index] || '';
            let ll = buckets.length;
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
    return string.replace(/([\-.*+?\^${}()|\[\]\/\\])/g, '\\$1');
};

const join = function (strings) {
    let output = '';
    for (let i = 0, l = strings.length; i < l; i += 1) {
        const part = strings[i];
        if (typeof part === 'string') {
            output += escapeRegExp(part);
        } else {
            const optional = part.some((array) => {
                return array[0] === '';
            });
            let section = part
                .filter((array) => {
                    return !!array[0];
                })
                .map((array) => {
                    return join(array);
                })
                .join('|');
            if (section.length > 1) {
                section = '(?:' + section + ')';
            }
            if (optional) {
                section += '?';
            }
            output += section;
        }
    }
    return output;
};

const makeRegExp = function (strings) {
    const regexp = join(divide(strings.reduce(flatten, []), 0));
    return '/^' + regexp + '\\b/i';
};

const formatHeaderLine = function (text, length) {
    return (
        '// ' +
        text +
        new Array(length - 6 - text.length + 1).join(' ') +
        ' \\\\\n'
    );
};

// Going to insert functions into our object.
Function.prototype.toJSON = function () {
    return this.toString();
};

const _makeLangModule = function (code, idList, idToEntry) {
    const getString = function (id) {
        const obj = idToEntry[id];
        return obj ? obj.translation || obj.string || obj.fallback : '';
    };

    const localisation = {
        code,

        decimalPoint: getString('S_FORMAT_DECIMAL_POINT'),
        thousandsSeparator: getString('S_FORMAT_THOUSANDS_SEPARATOR'),

        fileSizeUnits: [
            getString('SIZE_BYTES'),
            getString('SIZE_KILOBYTES'),
            getString('SIZE_MEGABYTES'),
            getString('SIZE_GIGABYTES'),
        ],

        getFormattedOrdinal: /^en/.test(code)
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
              }
            : code === 'nl'
            ? function (number) {
                  return number + 'e';
              }
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
            const year = /%\-?Y/i.exec(format).index;
            const month = /%\-?[mb]/i.exec(format).index;
            const day = /%\-?d/i.exec(format).index;
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

        translations: idList.map(getString),
    };

    return (
        '' +
        formatHeaderLine(new Array(80 - 6 + 1).join('-'), 80) +
        formatHeaderLine('File: ' + code + '.js', 80) +
        formatHeaderLine('Module: Locale', 80) +
        formatHeaderLine(
            'License: © 2010–' +
                new Date().getFullYear() +
                ' Fastmail Pty Ltd. MIT Licensed.       ',
            80,
        ) +
        formatHeaderLine(new Array(80 - 6 + 1).join('-'), 80) +
        '\n' +
        '( function () { const x = new O.Locale(' +
        JSON.stringify(localisation, null, 2)
            .replace(/"(\/.*?\/i?)"/g, (_, regexp) =>
                regexp.replace(/\\\\/g, '\\'),
            )
            .replace(/"(function[\s\S]*?})"/g, (_, fn) =>
                fn.replace(/\\n/g, '\n'),
            ) +
        ');\nO.i18n.addLocale( x );\nO.i18n.setLocale("' +
        code +
        '")}() );'
    );
};

const makeLangModule = function (idListPath, poPath, outputPath) {
    const code = /.*\/(.*)\.js$/.exec(outputPath)[1];
    const idList = parseLang(fs.readFileSync(idListPath, 'utf8'));
    const idToEntry = parseLang(fs.readFileSync(poPath, 'utf8'));

    fs.writeFileSync(outputPath, _makeLangModule(code, idList, idToEntry));
};

const insertLocale = function (englishDbPath, strings, input, output) {
    const db = parseDb(fs.readFileSync(englishDbPath, 'utf8'));
    const stringToEntry = indexDB(db, 'string');
    const index = {};
    strings = JSON.parse(fs.readFileSync(strings, 'utf8'));
    strings.forEach((string, i) => {
        index[string] = i;
    });
    input = fs.readFileSync(input, 'utf8');
    input = input.replace(locExtractor, (_, id) => {
        if (!isId.test(id)) {
            id = stringToEntry[id].id;
        }
        return 'loc( ' + index[id];
    });

    fs.writeFileSync(output, input);
};

const insertEnglish = function (englishDbPath, input, output) {
    const db = parseDb(fs.readFileSync(englishDbPath, 'utf8'));
    const stringToEntry = indexDB(db, 'string');
    const idToEntry = indexDB(db, 'id');
    input = fs.readFileSync(input, 'utf8');
    input = input.replace(locExtractor, (_, id) => {
        if (!isId.test(id)) {
            id = stringToEntry[id].id;
        }
        return 'loc( ' + JSON.stringify(idToEntry[id].string);
    });

    fs.writeFileSync(output, input);
};

const updatePo = function (
    englishDbPath,
    usagePath,
    inputPoPath,
    outputPoPath,
) {
    const db = parseDb(fs.readFileSync(englishDbPath, 'utf8'));
    const inputPo = parseLang(fs.readFileSync(inputPoPath, 'utf8'));
    // usage = JSON.parseLang(fs.readFileSync(usagePath, 'utf8'));

    Object.keys(db).forEach((stringId) => {
        const dbObj = db[stringId];
        let inputPoObj = inputPo[stringId];

        if (!inputPoObj) {
            inputPoObj = inputPo[stringId] = { ...dbObj };
            inputPoObj.flags = ['fuzzy'];
            inputPoObj.translation = '';
        } else {
            // if description doesn't match, just update it
            if (dbObj.description !== inputPoObj.description) {
                inputPoObj.description = dbObj.description || undefined;
            }
            // if string has changed, update it.  we're fuzzy now.
            if (dbObj.string !== inputPoObj.string) {
                inputPoObj.string = dbObj.string;
                inputPoObj.flags = ['fuzzy'];
            }
        }
    });

    fs.writeFileSync(outputPoPath, stringify(inputPo));
};

const dbToPo = function (englishDbPath, outputPoPath, /* makePot */) {
    const db = parseDb(fs.readFileSync(englishDbPath, 'utf8'));

    const addFuzzy = outputPoPath.slice(-10) !== 'en.lang.js';

    Object.keys(db).forEach((key) => {
        db[key].translation = '';
        if (addFuzzy) {
            db[key].flags = ['fuzzy'];
        }
    });

    fs.writeFileSync(outputPoPath, stringify(db));
};

const removeUnusedDB = function (dbPath, usagePath, outputPath) {
    const db = parseDb(fs.readFileSync(dbPath, 'utf8'));
    const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    Object.keys(db).forEach((key) => {
        if (usage[key]) {
            delete db[key];
        }
    });
    fs.writeFileSync(outputPath, stringify(db));
};

(function () {
    const args = process.argv.slice(2);
    switch (args[0]) {
        case 'enumerate':
            extract(
                // 1. EnglishDB
                // 2. const args... files to scan
                // 3. Output
                // 4. All data
                args[1],
                args.slice(2, -1),
                args[args.length - 1],
                false,
            );
            break;
        case 'findUses':
            extract(
                // 1. EnglishDB
                // 2. const args... files to scan
                // 3. Output
                // 4. All data
                // 5. Include getString
                args[1],
                args.slice(2, -1),
                args[args.length - 1],
                true,
                true,
            );
            break;
        case 'makeLangModule':
            // 1. Strings.json
            // 2. Lang.po
            // 3. Output
            makeLangModule(args[1], args[2], args[3]);
            break;
        case 'insertLocale':
            // 1. EnglishDb
            // 2. Strings.json
            // 3. Input
            // 4. Output
            insertLocale(args[1], args[2], args[3], args[4]);
            break;
        case 'insertEnglish':
            // 1. EnglishDb
            // 3. Input
            // 4. Output
            insertEnglish(args[1], args[2], args[3]);
            break;
        case 'dbToLang':
            dbToPo(args[1], args[2], false);
            break;
        // case 'dbToPot':
        //     dbToPo(args[1], args[2], true);
        //     break;
        case 'updateLang':
            updatePo(args[1], args[2], args[3], args[4]);
            break;
        case 'removeUnusedDB':
            removeUnusedDB(args[1], args[2], args[3]);
            break;
    }
})();
