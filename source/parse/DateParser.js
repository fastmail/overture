import { mod } from '../core/Math.js';
import { getLocale, loc } from '../localisation/i18n.js';
import {
    define,
    firstMatch,
    longestMatch,
    not,
    optional,
    ParseResult,
    sequence,
} from './Parse.js';

import '../core/String.js'; // For String#escapeRegExp

// --- Date Grammar ---

const JUST_TIME = 1;
const JUST_DATE = 2;
const DATE_AND_TIME = 3;

const generateLocalisedDateParser = function (locale, mode) {
    const datePatterns = locale.datePatterns;

    const anyInLocale = function (type, names) {
        return firstMatch(
            names
                .split(' ')
                .map((name) => define(type, datePatterns[name], name)),
        );
    };

    const whitespace = define('whitespace', /^(?:[\s"'()]+|$)/);

    const hours = define('hour', /^(?:2[0-3]|[01]?\d)/);
    const shorthours = define('hour', /^[12]/);
    const minutes = define('minute', /^[0-5][0-9]/);
    const seconds = define('second', /^[0-5][0-9]/);
    const meridian = firstMatch([
        define('am', datePatterns.am),
        define('pm', datePatterns.pm),
    ]);
    const timeSuffix = sequence([optional(whitespace), meridian]);
    const timeDelimiter = define('timeDelimiter', /^[:.]/);
    const timeContext = define('timeContext', datePatterns.timeContext);
    const time = firstMatch([
        sequence([
            hours,
            optional(
                sequence([
                    timeDelimiter,
                    minutes,
                    optional(sequence([timeDelimiter, seconds])),
                ]),
            ),
            optional(timeSuffix),
            whitespace,
        ]),
        sequence([
            firstMatch([
                sequence([hours, minutes]),
                sequence([shorthours, minutes]),
            ]),
            optional(timeSuffix),
            whitespace,
        ]),
    ]);

    if (mode === JUST_TIME) {
        return firstMatch([time, whitespace]);
    }

    const ordinalSuffix = define('ordinalSuffix', datePatterns.ordinalSuffix);

    const weekday = anyInLocale('weekday', 'sun mon tue wed thu fri sat');
    const day = sequence([
        define('day', /^(?:[0-2]\d|3[0-1]|\d)/),
        optional(ordinalSuffix),
        not(timeContext),
    ]);
    const monthnumber = sequence([
        define('month', /^(?:1[0-2]|0\d|\d)/),
        not(firstMatch([timeContext, ordinalSuffix])),
    ]);
    const monthname = anyInLocale(
        'monthname',
        'jan feb mar apr may jun jul aug sep oct nov dec',
    );
    const month = firstMatch([monthnumber, monthname]);
    const fullyear = define('year', /^\d{4}/);
    const year = sequence([
        define('year', /^\d\d(?:\d\d)?/),
        not(firstMatch([timeContext, ordinalSuffix])),
    ]);
    const searchMethod = anyInLocale('searchMethod', 'past future');

    const format = loc('%A, %B %d, %Y %X');
    const delimiters = new Set(['-', '.', ',', "'", '/']);
    for (let i = 0, l = format.length; i < l; i += 1) {
        const char = format.charAt(i);
        if (char === '%') {
            i += 1;
            if (format.charAt(i) === '-') {
                i += 1;
            }
            continue;
        }
        delimiters.add(char);
    }

    const dateDelimiter = define(
        'dateDelimiter',
        new RegExp(
            '^(?:[\\s' + [...delimiters].join('').escapeRegExp() + ']|of)+',
        ),
    );

    const relativeDate = anyInLocale(
        'relativeDate',
        'yesterday tomorrow today now',
    );

    const adjustSign = define('adjustSign', /^[+-]/);
    const adjustUnit = define(
        'adjustUnit',
        /^(?:day|week|month|year)|[dwmy](?!\w)/i,
    );
    const adjustNumber = define('adjustNumber', /^\d+/);
    const adjust = sequence([
        optional(adjustSign),
        adjustNumber,
        optional(whitespace),
        adjustUnit,
    ]);

    const standardDate = sequence(
        locale.dateFormats.date
            .split(/%-?([dmbY])/)
            .map((part, i) => {
                if (i & 1) {
                    switch (part) {
                        case 'd':
                            return day;
                        case 'm':
                            return monthnumber;
                        case 'b':
                            return monthname;
                        case 'Y':
                            return year;
                    }
                } else if (part) {
                    return define(
                        'dateDelimiter',
                        new RegExp('^' + part.escapeRegExp()),
                    );
                }
                return null;
            })
            .filter((x) => x),
    );

    const dayMonthYear = sequence([
        day,
        dateDelimiter,
        month,
        dateDelimiter,
        year,
    ]);
    const dayMonth = sequence([day, dateDelimiter, month]);
    const monthYear = sequence([month, dateDelimiter, year, not(timeContext)]);
    const monthDayYear = sequence([
        month,
        dateDelimiter,
        day,
        dateDelimiter,
        year,
    ]);
    const monthDay = sequence([month, dateDelimiter, day]);
    const yearMonthDay = sequence([
        year,
        dateDelimiter,
        month,
        dateDelimiter,
        day,
    ]);
    const yearMonth = sequence([year, dateDelimiter, month]);

    const date = sequence([
        firstMatch([
            standardDate,
            longestMatch(
                locale.dateElementOrder === 'dmy'
                    ? [
                          dayMonthYear,
                          dayMonth,
                          monthYear,
                          monthDayYear,
                          monthDay,
                          yearMonthDay,
                          yearMonth,
                      ]
                    : locale.dateElementOrder === 'mdy'
                    ? [
                          monthDayYear,
                          monthDay,
                          monthYear,
                          dayMonthYear,
                          dayMonth,
                          yearMonthDay,
                          yearMonth,
                      ]
                    : [
                          yearMonthDay,
                          yearMonth,
                          dayMonthYear,
                          dayMonth,
                          monthYear,
                          monthDayYear,
                          monthDay,
                      ],
            ),
        ]),
        not(define('', /^\d/)),
    ]);

    if (mode === JUST_DATE) {
        return firstMatch([
            date,
            weekday,
            fullyear,
            monthname,
            relativeDate,
            adjust,
            day,
            searchMethod,
            whitespace,
        ]);
    }

    return firstMatch([
        date,
        weekday,
        fullyear,
        monthname,
        relativeDate,
        adjust,
        day,
        time,
        searchMethod,
        whitespace,
    ]);
};

// --- Interpreter ---

const monthNameToIndex = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
};

const dayNameToIndex = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

const letterToUnit = {
    d: 'day',
    w: 'week',
    m: 'month',
    y: 'year',
};

const isLeapYear = Date.isLeapYear;
const getDaysInMonth = Date.getDaysInMonth;

const NOW = 0;
const PAST = -1;
const FUTURE = 1;

const interpreter = {
    interpret(tokens, expectedTense) {
        const date = {};
        const l = tokens.length;
        for (let i = 0; i < l; i += 1) {
            const token = tokens[i];
            const name = token[0];
            if (this[name]) {
                this[name](date, token[1], token[2], tokens);
            }
        }
        return this.findDate(date, date.searchMethod || expectedTense);
    },
    findDate(constraints, searchMethod) {
        const keys = Object.keys(constraints);
        if (!keys.length) {
            return null;
        }
        const date = new Date();
        const currentDay = date.getDate();

        // If we don't do this, setting month lower down could go wrong,
        // because if the date is 30th and we set month as Feb, we'll end up
        // in March!
        date.setDate(1);

        // Time:
        date.setHours(constraints.hour || 0);
        date.setMinutes(constraints.minute || 0);
        date.setSeconds(constraints.second || 0);
        date.setMilliseconds(0);

        // Date:
        let day = constraints.day;
        let month = constraints.month;
        let year = constraints.year;
        const weekday = constraints.weekday;
        const adjust = constraints.adjust;

        const hasMonth = !!(month || month === 0);
        const hasWeekday = !!(weekday || weekday === 0);

        const dayInMs = 86400000;

        if (day && hasMonth && year) {
            const daysInMonth = getDaysInMonth(month, year);
            if (day > daysInMonth) {
                day = daysInMonth;
            }
            date.setFullYear(year);
            date.setMonth(month);
            date.setDate(day);
        } else if (hasMonth && year) {
            date.setFullYear(year);
            date.setMonth(month);
            if (hasWeekday) {
                if (searchMethod !== PAST) {
                    // Date is currently 1.
                    day = mod(weekday - date.getDay(), 7) + 1;
                } else {
                    date.setDate((day = getDaysInMonth(month, year)));
                    day = day - mod(date.getDay() - weekday, 7);
                }
            } else {
                day = 1;
            }
            date.setDate(day);
        } else if (day && hasMonth) {
            const currentMonth = date.getMonth();
            year = date.getFullYear();
            // We just use the current year if searchMethod === NOW
            // If it's FUTURE or PAST though, make sure the date conforms to
            // that.
            if (searchMethod === FUTURE) {
                if (
                    month < currentMonth ||
                    (month === currentMonth && day <= currentDay)
                ) {
                    year += 1;
                }
            }
            if (searchMethod === PAST) {
                if (
                    month > currentMonth ||
                    (month === currentMonth && day >= currentDay)
                ) {
                    year -= 1;
                }
            }
            date.setFullYear(year);
            date.setMonth(month);
            date.setDate(day);
            // If we have a weekday constraint, iterate in the past or future
            // direction until we find a year where that matches.
            if (hasWeekday) {
                const isFeb29 = day === 29 && month === 1;
                if (isFeb29) {
                    while (!isLeapYear(year)) {
                        year += searchMethod || 1;
                    }
                    date.setFullYear(year);
                }
                const delta = (isFeb29 ? 4 : 1) * (searchMethod || 1);
                while (date.getDay() !== weekday) {
                    do {
                        year += delta;
                        // We only need to loop if looking for a leap year
                        // eslint-disable-next-line no-unmodified-loop-condition
                    } while (isFeb29 && !isLeapYear(year));
                    date.setFullYear(year);
                }
            }
        } else if (day) {
            year = date.getFullYear();
            month = date.getMonth();
            date.setDate(day);
            if (hasWeekday) {
                // Find month which satisfies this.
                while (date.getDay() !== weekday || date.getDate() !== day) {
                    if (searchMethod === PAST) {
                        if (month) {
                            month -= 1;
                        } else {
                            year -= 1;
                            month = 11;
                        }
                    } else {
                        if (month < 11) {
                            month += 1;
                        } else {
                            year += 1;
                            month = 0;
                        }
                    }
                    date.setFullYear(year);
                    date.setMonth(month);
                    date.setDate(day);
                }
            } else if (searchMethod === PAST && day > currentDay) {
                date.setMonth(month - 1);
            } else if (searchMethod === FUTURE && day < currentDay) {
                date.setMonth(month + 1);
            }
        } else if (hasMonth) {
            year = date.getFullYear();
            const currentMonth = date.getMonth();
            // We just use the current year if searchMethod === NOW
            // If it's FUTURE or PAST though, make sure the date conforms to
            // that.
            if (searchMethod === FUTURE && month <= currentMonth) {
                year += 1;
            }
            if (searchMethod === PAST && month > currentMonth) {
                year -= 1;
            }
            date.setFullYear(year);
            date.setMonth(month);

            if (hasWeekday) {
                if (searchMethod !== PAST) {
                    day = mod(weekday - date.getDay(), 7) + 1;
                } else {
                    date.setDate((day = getDaysInMonth(month, year)));
                    day = day - mod(date.getDay() - weekday, 7);
                }
                date.setDate(day);
            }
        } else if (year) {
            date.setFullYear(year);
            date.setMonth(0);
            if (hasWeekday) {
                if (searchMethod !== PAST) {
                    day = mod(weekday - date.getDay(), 7) + 1;
                } else {
                    date.setMonth(11);
                    date.setDate((day = getDaysInMonth(11, year)));
                    day = day - mod(date.getDay() - weekday, 7);
                }
                date.setDate(day);
            }
        } else if (hasWeekday) {
            date.setDate(currentDay);
            if (searchMethod === PAST) {
                date.setTime(date.getTime() - dayInMs);
                date.setTime(
                    date.getTime() - dayInMs * mod(date.getDay() - weekday, 7),
                );
            } else {
                date.setTime(date.getTime() + dayInMs);
                date.setTime(
                    date.getTime() + dayInMs * mod(weekday - date.getDay(), 7),
                );
            }
        } /* Default to today */ else {
            date.setDate(currentDay);
        }

        if (adjust) {
            for (let i = 0, l = adjust.length; i < l; i += 1) {
                date.add(adjust[i][0], adjust[i][1], false);
            }
        }

        return date;
    },

    weekday(date, string, weekday) {
        date.weekday = dayNameToIndex[weekday];
    },
    day(date, string) {
        date.day = +string;
    },
    month(date, string) {
        date.month = +string - 1;
    },
    monthname(date, string, name) {
        date.month = monthNameToIndex[name];
    },
    year(date, string) {
        let year = +string;
        if (string.length === 2) {
            year += 2000;
            if (year > new Date().getFullYear() + 30) {
                year -= 100;
            }
        }
        date.year = year;
    },
    hour(date, string) {
        date.hour = +string;
        const meridian = date.meridian;
        if (meridian) {
            this[meridian](date);
        }
    },
    minute(date, string) {
        date.minute = +string;
    },
    second(date, string) {
        date.second = +string;
    },
    am(date) {
        date.meridian = 'am';
        const hour = date.hour;
        if (hour && hour === 12) {
            date.hour = 0;
        }
    },
    pm(date) {
        date.meridian = 'pm';
        const hour = date.hour;
        if (hour && hour < 12) {
            date.hour = hour + 12;
        }
    },
    searchMethod(date, string, pastOrFuture) {
        date.searchMethod = pastOrFuture === 'past' ? PAST : FUTURE;
    },
    relativeDate(date, string, context) {
        const now = new Date();
        const dayInMs = 86400000;
        switch (context) {
            case 'yesterday':
                now.setTime(now.getTime() - dayInMs);
                break;
            case 'tomorrow':
                now.setTime(now.getTime() + dayInMs);
                break;
        }
        date.day = now.getDate();
        date.month = now.getMonth();
        date.year = now.getFullYear();
    },
    adjustSign(date, sign) {
        if (!date.adjust) {
            date.adjust = [];
        }
        date.adjust.push([sign === '+' ? 1 : -1, 'day']);
    },
    adjustNumber(date, number) {
        if (!date.adjust) {
            date.adjust = [[-1, 'day']];
        }
        date.adjust.last()[0] *= number;
    },
    adjustUnit(date, unit) {
        unit = unit.toLowerCase();
        unit = letterToUnit[unit] || unit;
        date.adjust.last()[1] = unit;
    },
};

// ---

const unknown = define('unknown', /^[^\s]+/);

const dateParsers = {};
const parseDateTime = function (string, locale, mode) {
    if (!locale) {
        locale = getLocale();
    }
    string = string
        .trim()
        .replace(/[０-９]/g, (wideNum) =>
            String.fromCharCode(wideNum.charCodeAt(0) - 65248),
        );
    const code = locale.code + mode;
    const dateParser =
        dateParsers[code] ||
        (dateParsers[code] = generateLocalisedDateParser(locale, mode));
    const parse = new ParseResult(string);
    while (parse.string.length) {
        if (!dateParser(parse)) {
            // We've hit something unexpected. Skip it.
            unknown(parse);
        }
    }
    return parse.tokens;
};

const interpretDateTime = function (tokens, expectedTense) {
    return interpreter.interpret(tokens, expectedTense || NOW);
};

const time = function (string, locale) {
    const tokens = parseDateTime(string, locale, JUST_TIME);
    return interpreter.interpret(tokens);
};

const date = function (string, expectedTense, locale) {
    const tokens = parseDateTime(string, locale, JUST_DATE);
    return interpreter.interpret(tokens, expectedTense || NOW);
};

const dateTime = function (string, expectedTense, locale) {
    const tokens = parseDateTime(string, locale, DATE_AND_TIME);
    return interpreter.interpret(tokens, expectedTense || NOW);
};

export {
    parseDateTime as tokeniseDateTime,
    interpretDateTime,
    time,
    date,
    dateTime,
    PAST,
    NOW,
    FUTURE,
    JUST_TIME,
    JUST_DATE,
    DATE_AND_TIME,
};
