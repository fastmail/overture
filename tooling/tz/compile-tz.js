const parseYear = function (year) {
    year = year.toLowerCase();
    if ('minimum'.indexOf(year) === 0) {
        return -1e9;
    }
    if ('maximum'.indexOf(year) === 0) {
        return 1e9;
    }
    if ('only'.indexOf(year) === 0) {
        return 0;
    }
    const num = parseInt(year, 10);
    if (isNaN(num)) {
        throw 'Cannot parse year ' + year;
    }
    return num;
};

const months = {
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

const parseMonth = function (month) {
    const monthNum = months[month.toLowerCase()];
    if (isNaN(monthNum)) {
        throw 'Cannot parse month ' + month;
    }
    return monthNum;
};

const isLeapYear = function (year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const getDaysInMonth = function (month, year) {
    return month === 1 && isLeapYear(year) ? 29 : daysInMonths[month];
};

const parseDateDay = function (dateDay) {
    const date = parseInt(dateDay.replace(/\D/g, ''), 10) || 0;
    let day = /Sun(day)?/i.test(dateDay)
        ? 1
        : /Mon(day)?/i.test(dateDay)
        ? 2
        : /Tues?(day)?/i.test(dateDay)
        ? 3
        : /Wed(nesday)?/i.test(dateDay)
        ? 4
        : /Thur?s?(day)?/i.test(dateDay)
        ? 5
        : /Fri(day)?/i.test(dateDay)
        ? 6
        : /Sat(urday)?/i.test(dateDay)
        ? 7
        : 0;
    if (day && !/>=/.test(dateDay)) {
        day = -day;
    }
    return [date, day];
};

const parseTime = function (time) {
    if (time === '-') {
        return [0, 0, 0, 2];
    }
    const parts =
        /([+-])?([012]?\d)(?::([0-5]\d))?(?::([0-5]\d))?([wsguz])?/.exec(time);
    if (!parts) {
        throw 'Cannot parse time ' + time;
    }
    const sign = parts[1] === '-' ? -1 : 1;
    return [
        sign * parseInt(parts[2] || 0, 10),
        sign * parseInt(parts[3] || 0, 10),
        sign * parseInt(parts[4] || 0, 10),
        parts[5] === 's' ? 1 : /[guz]/.test(parts[5] || '') ? 0 : 2,
    ];
};

const formatRule = function (parts) {
    const dateDay = parseDateDay(parts[6]);
    const time = parseTime(parts[7]);
    const offset = parseTime(parts[8]);
    return [
        parseYear(parts[2]), // Start year
        parseYear(parts[3]) || parseYear(parts[2]), // End year
        parseMonth(parts[5]), // Month
        dateDay[0], // Date (or 0 for last in month)
        dateDay[1], // Day (0 for none, +/-1-7 for next/prev sun-sat)
        time[0], // hour
        time[1], // minute
        time[2], // second
        time[3], // utc=0/local=1/wall=2
        60 * (60 * offset[0] + offset[1]) + offset[2], // offset in seconds
        parts[9] === '-' ? '' : parts[9], // letters
    ];
};

const formatZone = function (parts) {
    let offset = parseTime(parts[0]);
    const offsetInSeconds = 60 * (60 * offset[0] + offset[1]) + offset[2];
    const year = parts[3] ? parseYear(parts[3]) : 0;
    const month = parts[4] ? parseMonth(parts[4]) : 0;
    const dateDay = parts[5] ? parseDateDay(parts[5]) : [1, 0];
    const date = dateDay[0] || getDaysInMonth(month, year);
    let day = dateDay[1];
    const time = parseTime(parts[6] || '-');
    // TODO: We should check if a rule still applies at the transition point
    // and if so, adjust the offset to get UTC correctly.
    const until = year
        ? new Date(Date.UTC(year, month, date, time[0], time[1], time[2]))
        : 0;
    if (day) {
        offset = day > 0 ? 86400000 : -86400000;
        day = Math.abs(day) - 1;
        while (until.getUTCDay() !== day) {
            until.setTime(+until + offset);
        }
    }
    if (until && time[3]) {
        until.setTime(until - offsetInSeconds * 1000);
    }
    return [
        +until, // Until (JS timestamp)
        offsetInSeconds, // offset (seconds)
        parts[1], // Rules
        parts[2], // Suffix
    ];
};

const sortZones = function (a, b) {
    if (!a[0]) {
        return 1;
    }
    if (!b[0]) {
        return -1;
    }
    return a[0] - b[0];
};

const sortRules = function (a, b) {
    return a[1] - b[1];
};

// The following obsolete names are aliases rather than linked
const alwaysAlias = {
    'GMT': true,
    'Etc/Universal': true,
    'Etc/Zulu': true,
    'Etc/Greenwich': true,
    'Etc/GMT-0': true,
    'Etc/GMT+0': true,
    'Etc/GMT0': true,
};

// We link rather than alias the common US/* zones, for ease of use
// by Americans
const alwaysLink = {
    'US/Alaska': true,
    'US/Arizona': true,
    'US/Central': true,
    'US/Eastern': true,
    'US/Hawaii': true,
    'US/Mountain': true,
    'US/Pacific': true,
};

// The following obsolete zones are defined in Olsen: alias them into an
// equivalent modern zone
const obsoleteZones = {
    WET: 'Europe/Lisbon',
    CET: 'Europe/Paris',
    MET: 'Europe/Paris',
    EET: 'Europe/Helsinki',
    EST: 'Etc/GMT+5',
    MST: 'Etc/GMT+7',
    HST: 'Etc/GMT+10',
    EST5EDT: 'America/New_York',
    CST6CDT: 'America/Chicago',
    MST7MDT: 'America/Denver',
    PST8PDT: 'America/Los_Angeles',
};

const convertFile = function (text, isLinkAlias) {
    const lines = text.replace(/#.*$/gm, '').split('\n');
    const zones = {};
    const rules = {};
    const usedRules = {};
    const result = {
        alias: {},
        link: {},
        zones,
        rules,
    };
    let i;
    let l;
    let line;
    let parts;
    let zone;
    let rule;
    let parsedZone;
    let id;
    let periods;
    for (i = 0, l = lines.length; i < l; i += 1) {
        line = lines[i].trim();
        // Comment
        if (!line) {
            continue;
        }
        parts = line.split(/\s+/);
        if (!parts.length) {
            continue;
        }
        // console.log( 'parsing line ' + i + ': ' + line );
        switch (parts[0]) {
            case 'Link':
                zone = parts[2];
                if ((isLinkAlias || alwaysAlias[zone]) && !alwaysLink[zone]) {
                    result.alias[zone] = parts[1];
                } else {
                    result.link[zone] = parts[1];
                }
                break;
            case 'Rule':
                rule = formatRule(parts);
                // Ignore rules pre 1970
                if (rule[1] < 1970) {
                    continue;
                }
                (rules[parts[1]] || (rules[parts[1]] = [])).push(rule);
                break;
            case 'Zone':
                zone = parts[1];
                // Handle obsolete legacy timezones.
                if (zone.indexOf('/') === -1) {
                    const alias = obsoleteZones[zone];
                    if (alias) {
                        result.alias[zone] = alias;
                    } else {
                        console.log('Unhandled obsolete zone: ' + zone);
                    }
                    continue;
                }
                parts = parts.slice(2);
            /* falls through */
            default:
                parsedZone = formatZone(parts);
                // Ignore rules pre 1970
                if (parsedZone[0] < 0) {
                    continue;
                }
                usedRules[parsedZone[2]] = true;
                (zones[zone] || (zones[zone] = [])).push(parsedZone);
        }
    }

    // Now sort
    for (id in zones) {
        periods = zones[id];
        periods.sort(sortZones);
        // If the only rules are pre 1970, we may not have a rule block at all,
        // but the period could still reference it.
        periods.forEach((period) => {
            if (!rules[period[2]]) {
                period[2] = '-';
            }
        });
    }
    for (id in rules) {
        if (!usedRules[id]) {
            delete rules[id];
        } else {
            rules[id].sort(sortRules);
        }
    }
    return result;
};

const compile = function (id, code) {
    const isLinkAlias = /backward/.test(id);
    const json = convertFile(code, isLinkAlias);
    const generatedCode =
        'export default ' +
        JSON.stringify(json, null, 2)
            .replace(/\n\s+((?:"[^"]*"|\-?\d+),?)$/gm, ' $1')
            .replace(/([\d\"])\n\s*\]/g, '$1 ]');

    return {
        code: generatedCode,
        map: { mappings: '' },
    };
};

export default compile;
