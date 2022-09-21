const define = function (name, regexp, context) {
    return function (parse) {
        const string = parse.string;
        const result = regexp.exec(string);
        if (result) {
            const part = result[0];
            parse.tokens.push([name, part, context || null]);
            parse.string = string.slice(part.length);
        }
        return !!result;
    };
};

const optional = function (pattern) {
    return function (parse) {
        pattern(parse);
        return true;
    };
};

const not = function (pattern) {
    return function (parse) {
        const newParse = parse.clone();
        return !pattern(newParse);
    };
};

const repeat = function (pattern, min, max) {
    // Max int: 2^31 - 1;
    if (!max) {
        max = 2147483647;
    }
    return function (parse) {
        const newParse = parse.clone();
        let i = 0;
        do {
            if (pattern(newParse)) {
                i += 1;
            } else {
                break;
            }
        } while (i < max);
        if (i >= min) {
            if (i) {
                parse.assimilate(newParse);
            }
            return true;
        }
        return false;
    };
};

const sequence = function (patterns) {
    return function (parse) {
        const newParse = parse.clone();
        for (let i = 0, l = patterns.length; i < l; i += 1) {
            if (!patterns[i](newParse)) {
                return false;
            }
        }
        // Successful: copy over results of parse
        parse.assimilate(newParse);
        return true;
    };
};

const firstMatch = function (patterns) {
    return function (parse) {
        for (let i = 0, l = patterns.length; i < l; i += 1) {
            if (patterns[i](parse)) {
                return true;
            }
        }
        return false;
    };
};

const longestMatch = function (patterns) {
    return function (parse) {
        const parses = [];
        const length = patterns.length;
        for (let i = 0; i < length; i += 1) {
            const newParse = parse.clone();
            if (patterns[i](newParse)) {
                parses.push(newParse);
                // Have we found a perfect parse? If so, stop.
                if (!newParse.string) {
                    break;
                }
            }
        }
        // Find the parse with shortest string left over.
        const parsesLength = parses.length;
        if (parsesLength) {
            let newParse = parses[parsesLength - 1];
            for (let j = parsesLength - 2; j >= 0; j -= 1) {
                if (parses[j].string.length <= newParse.string.length) {
                    newParse = parses[j];
                }
            }
            parse.assimilate(newParse);
            return true;
        }
        return false;
    };
};

class ParseResult {
    constructor(string, tokens) {
        this.string = string;
        this.tokens = tokens || [];
    }
    clone() {
        return new ParseResult(this.string, this.tokens.slice());
    }
    assimilate(parse) {
        this.string = parse.string;
        this.tokens = parse.tokens;
    }
}

export {
    define,
    optional,
    not,
    repeat,
    sequence,
    firstMatch,
    longestMatch,
    ParseResult,
};
