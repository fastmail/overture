import '../core/Date.js'; // For Date#add
import '../core/String.js'; // For String#format

// Periods format:
// until posix time, offset (secs), rules name, suffix
// e.g. [ +new Date(), -3600, 'EU', 'CE%sT' ]

const getPeriod = function (periods, date, isUTC) {
    const lastIndex = periods.length - 1;
    let period = periods[lastIndex];
    for (let i = lastIndex - 1; i >= 0; i -= 1) {
        const candidate = periods[i];
        if (candidate[0] < date - (isUTC ? 0 : candidate[1])) {
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

const tzRules = {
    '-': [],
};

const getRule = function (rules, offset, datetime, isUTC, recurse) {
    const year = datetime.getUTCFullYear();
    let ruleInEffect = null;
    let prevRule;
    let dateInEffect;
    for (let i = rules.length - 1; i >= 0; i -= 1) {
        const rule = rules[i];
        // Sorted by end year. So if ends before this date, no further rules
        // can apply.
        if (rule[1] < year) {
            break;
        }
        // If starts on or before this date, the rule applies.
        if (rule[0] <= year) {
            // Create the date object representing the transition point.
            const month = rule[2];
            // 0 => last day of the month
            const date = rule[3] || Date.getDaysInMonth(month, year);
            const ruleDate = new Date(Date.UTC(year, month, date));

            // Adjust to nearest +/- day of the week if specified
            const day = rule[4];
            if (day) {
                // +/- => (on or after/on or before) current date.
                // abs( value ) => 1=SUN,2=MON,... etc.
                const difference =
                    (Math.abs(day) - ruleDate.getUTCDay() + 6) % 7;
                if (difference) {
                    ruleDate.add(
                        day < 1 ? difference - 7 : difference,
                        'day',
                        true,
                    );
                }
            }

            // Set time (could be 24:00, which moves it to next day)
            ruleDate.setUTCHours(rule[5]);
            ruleDate.setUTCMinutes(rule[6]);
            ruleDate.setUTCSeconds(rule[7]);

            // Now match up timezones
            const ruleIsUTC = !rule[8];
            if (ruleIsUTC !== isUTC) {
                ruleDate.add((ruleIsUTC ? 1 : -1) * offset, 'second', true);
                // We need to add the offset of the previous rule. Sigh.
                // The maximum time offset from a rule is 2 hours. So if within
                // 3 hours, find the rule for the previous day.
                if (
                    rule[8] === 2 &&
                    Math.abs(ruleDate - datetime) <= 3 * 60 * 60 * 1000
                ) {
                    prevRule = getRule(
                        rules,
                        offset,
                        new Date(datetime - 86400000),
                        isUTC,
                        true,
                    );
                    if (prevRule) {
                        ruleDate.add(
                            (ruleIsUTC ? 1 : -1) * prevRule[9],
                            'second',
                            true,
                        );
                    }
                }
            }

            // If we're converting from UTC, the time could be valid twice
            // or invalid. We should pick the rule to follow RFC5545 guidance:
            // Presume the earlier rule is still in effect in both cases
            if (!isUTC) {
                ruleDate.add(rule[9], 'second', true);
                if (Math.abs(ruleDate - datetime) <= 3 * 60 * 60 * 1000) {
                    prevRule =
                        prevRule ||
                        getRule(
                            rules,
                            offset,
                            new Date(datetime - 86400000),
                            isUTC,
                            true,
                        );
                    if (prevRule) {
                        ruleDate.add(prevRule[9], 'second', true);
                    }
                }
            }

            // Does this replace a previously found rule?
            if (
                ruleDate <= datetime &&
                (!dateInEffect || ruleDate > dateInEffect)
            ) {
                ruleInEffect = rule;
                dateInEffect = ruleDate;
            }
        }
    }
    if (!ruleInEffect && recurse) {
        return getRule(
            rules,
            offset,
            new Date(Date.UTC(year - 1, 11, 31, 12, 0, 0)),
            isUTC,
            false,
        );
    }
    return ruleInEffect;
};

const switchSign = function (string) {
    return string.replace(/[+-]/, (sign) => (sign === '+' ? '-' : '+'));
};

const idToTZ = new Map();
const getTimeZoneById = (id) => idToTZ.get(id) || null;

class TimeZone {
    constructor(id, periods) {
        let name = id.replace(/_/g, ' ');
        // The IANA ids have the +/- the wrong way round for historical reasons.
        // Display correctly for the user.
        if (/GMT[+-]/.test(name)) {
            name = switchSign(name);
        }

        this.id = id;
        this.name = name;
        this.periods = periods;
    }

    convert(date, toTimeZone) {
        const period = getPeriod(this.periods, date);
        let offset = period[1];
        const rule = getRule(
            tzRules[period[2]] || [],
            offset,
            date,
            toTimeZone,
            true,
        );
        if (rule) {
            offset += rule[9];
        }
        if (!toTimeZone) {
            offset = -offset;
        }
        return new Date(+date + offset * 1000);
    }
    convertDateToUTC(date) {
        return this.convert(date, false);
    }
    convertDateToTimeZone(date) {
        return this.convert(date, true);
    }
    getSuffix(date) {
        const period = getPeriod(this.periods, date, false);
        const offset = period[1];
        let rule = getRule(tzRules[period[2]], offset, date, false, true);
        let suffix = period[3];
        const slashIndex = suffix.indexOf('/');
        // If there's a slash, e.g. "GMT/BST", presume first if no time offset,
        // second if time offset.
        if (rule && slashIndex > -1) {
            suffix = rule[9]
                ? suffix.slice(slashIndex + 1)
                : suffix.slice(0, slashIndex);
            rule = null;
        }
        return suffix.format(rule ? rule[10] : '');
    }
    toJSON() {
        return this.id;
    }

    static fromJSON(id) {
        return getTimeZoneById(id);
    }

    static isEqual(a, b) {
        return a.id === b.id;
    }

    static load(json) {
        const zones = json.zones;
        const link = json.link;
        const alias = json.alias;

        for (const id in zones) {
            idToTZ.set(id, new TimeZone(id, zones[id]));
        }
        for (const id in link) {
            idToTZ.set(
                id,
                new TimeZone(
                    id,
                    zones[link[id]] || idToTZ.get(link[id]).periods,
                ),
            );
        }
        for (const id in alias) {
            idToTZ.set(id, idToTZ.get(alias[id]));
        }
        Object.assign(tzRules, json.rules);
    }
}

export { TimeZone, getTimeZoneById };
