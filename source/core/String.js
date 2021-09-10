const splitter = /%(\+)?(?:'(.))?(-)?(\d+)?(?:\.(\d+))?(?:\$(\d+))?([%sn@])/g;

Object.assign(String.prototype, {
    /**
        Method: String#runeAt

        Like charAt, but if the index points to an octet that is part of a
        surrogate pair, the whole pair is returned (as a string).

        Parameters:
            index - {Number} The index (in bytes) into the string

        Returns:
            {String} The rune at this index.
    */
    runeAt(index) {
        let code = this.charCodeAt(index);

        // Outside bounds
        if (Number.isNaN(code)) {
            return ''; // Position not found
        }

        // Normal char
        if (code < 0xd800 || code > 0xdfff) {
            return this.charAt(index);
        }

        // High surrogate (could change last hex to 0xDB7F to treat high
        // private surrogates as single characters)
        if (0xd800 <= code && code <= 0xdbff) {
            if (this.length <= index + 1) {
                // High surrogate without following low surrogate
                return '';
            }
            // Low surrogate (0xDC00 <= code && code <= 0xDFFF)
        } else {
            if (index === 0) {
                // Low surrogate without preceding high surrogate
                return '';
            }
            index -= 1;
        }

        code = this.charCodeAt(index + 1);
        if (0xdc00 > code || code > 0xdfff) {
            // Not a valid surrogate pair
            return '';
        }

        return this.charAt(index) + this.charAt(index + 1);
    },

    /**
        Method: String#format

        Format a string by substituting in arguments. The method can also add
        padding to make the insertion a fixed width and restrict the number of
        decimal places in a number.

        A placeholder is denoted by a `%` sign, which followed by:

        1. (optional) *Sign*: `+` means always show sign.
        2. (optional) *Padding*: `'c` where `c` is any character. Default is
           space.
        3. (optional) *Alignment*: `-` means make left-aligned (default
           right-align).
        4. (optional) *Width*: Integer specifying number of characters in
           output.
        5. (optional) *Precision*: `.` + Number of digits after decimal point.
        6. (optional) *Argument*: `$` + Number of argument (indexed from 1) to
           use.
        7. *Type*: %, n, s, @.

        If no specific argument is used, the index of a placeholder is used to
        determine which argument to use. The possible argument types are String,
        Number or Object; these must match the placeholder types of 's', 'n' and
        '@' respectively. A literal % is inserted by %%. Objects are converted
        to strings via their toString() method.

        e.g. If the string is `"%+'*-16.3$2n"` and argument 2 is `123.456789`,
        then the output is: `"+123.457********"`.

        Parameters:
            var_args - {...(String|Number|Object)} The arguments to interpolate.

        Returns:
            {String} The formatted string.
    */
    format() {
        // Reset RegExp.
        splitter.lastIndex = 0;

        let output = '';
        let i = 0;
        let argIndex = 1;
        let part;

        while ((part = splitter.exec(this))) {
            // Add everything between last placeholder and this placeholder
            output += this.slice(i, part.index);
            // And set i to point to the next character after the placeholder
            i = part.index + part[0].length;

            // Find argument to subsitute in; either the one specified in
            // (6) or the index of this placeholder.
            const data = arguments[(parseInt(part[6], 10) || argIndex) - 1];

            // Generate the string form of the data from the type specified
            // in (7).
            let toInsert;
            switch (part[7]) {
                case '%':
                    // Special case: just output the character and continue;
                    output += '%';
                    continue;
                case 's':
                    toInsert = data;
                    break;
                case 'n':
                    // (1) Ensure sign will be shown
                    toInsert = part[1] && data >= 0 ? '+' : '';
                    // (5) Restrict number of decimal places
                    toInsert +=
                        part[5] !== undefined
                            ? data.toFixed(part[5])
                            : data + '';
                    break;
                case '@':
                    toInsert = data.toString();
                    break;
            }

            // (4) Check minimum width
            let padLength = (part[4] || 0) - toInsert.length;
            if (padLength > 0) {
                // Padding character is (2) or a space
                const padChar = part[2] || ' ';
                let padding = padChar;
                while ((padLength -= 1)) {
                    padding += padChar;
                }
                // Insert padding before unless (3) is set.
                if (part[3]) {
                    toInsert += padding;
                } else {
                    toInsert = padding + toInsert;
                }
            }

            // And add the string to the output
            output += toInsert;

            // Keep track of the arg index to use.
            argIndex += 1;
        }
        // Add any remaining string
        output += this.slice(i);

        return output;
    },

    /**
        Method: String#escapeHTML

        Returns the string with the characters <,>,& replaced by HTML entities.

        Returns:
            {String} The escaped string.
    */
    escapeHTML() {
        return this.split('&')
            .join('&amp;')
            .split('<')
            .join('&lt;')
            .split('>')
            .join('&gt;');
    },

    /**
        Method: String#escapeRegExp

        Escape any characters with special meaning when passed to the RegExp
        constructor.

        Returns:
            {String} The escaped string.
    */
    escapeRegExp() {
        return this.replace(/([-.*+?^${}()|[\]/\\])/g, '\\$1');
    },

    /**
        Method: String#capitalise

        Returns this string with the first letter converted to a capital.

        Returns:
            {String} The capitalised string.
    */
    capitalise() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    },

    /**
        Method: String#camelCase

        Returns this string with any sequence of a hyphen followed by a
        lower-case letter replaced by the capitalised letter.

        Returns:
            {String} The camel-cased string.
    */
    camelCase() {
        return this.replace(/-([a-z])/g, (_, letter) => {
            return letter.toUpperCase();
        });
    },

    /**
        Method: String#hyphenate

        Returns this string with any captials converted to lower case and
        preceded by a hyphen.

        Returns:
            {String} The hyphenated string.
    */
    hyphenate() {
        return this.replace(/[A-Z]/g, (letter) => {
            return '-' + letter.toLowerCase();
        });
    },

    /**
        Method: String#hash

        Hashes the string to return a number which should (in theory at least)
        be statistically randomly distributed over any set of inputs, and each
        change in a bit of input should result in a change in roughly 50% of the
        bits in the output. Algorithm from:
        <http://www.azillionmonkeys.com/qed/hash.html>

        Returns:
            {Number} The hash. This is a *signed* 32-bit int.
    */
    hash() {
        let hash = this.length;
        const remainder = hash & 1;
        const l = hash - remainder;

        for (let i = 0; i < l; i += 2) {
            hash += this.charCodeAt(i);
            hash = (hash << 16) ^ ((this.charCodeAt(i + 1) << 11) ^ hash);
            hash += hash >> 11;
        }

        if (remainder) {
            hash += this.charCodeAt(l);
            hash ^= hash << 11;
            hash += hash >> 17;
        }

        // Force "avalanching" of final 127 bits
        hash ^= hash << 3;
        hash += hash >> 5;
        hash ^= hash << 4;
        hash += hash >> 17;
        hash ^= hash << 25;
        hash += hash >> 6;

        return hash;
    },

    /**
        Method: String#md5

        Calculates the MD5 hash of the string.
        See <http://en.wikipedia.org/wiki/MD5>.

        Returns:
            {String} The 128 bit hash in the form of a hexadecimal string.
    */
    md5: (function () {
        const r = [
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9,
            14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4,
            11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15,
            21, 6, 10, 15, 21, 6, 10, 15, 21,
        ];

        const constants = [
            0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf,
            0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af,
            0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e,
            0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
            0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6,
            0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
            0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
            0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
            0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039,
            0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97,
            0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d,
            0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
            0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
        ];

        const utf16To8 = (string) => {
            let utf8 = '';
            for (let i = 0, l = string.length; i < l; i += 1) {
                const c = string.charCodeAt(i);
                if (c < 128) {
                    utf8 += string.charAt(i);
                } else if (c < 2048) {
                    utf8 += String.fromCharCode((c >> 6) | 192);
                    utf8 += String.fromCharCode((c & 63) | 128);
                } else {
                    utf8 += String.fromCharCode((c >> 12) | 224);
                    utf8 += String.fromCharCode(((c >> 6) & 63) | 128);
                    utf8 += String.fromCharCode((c & 63) | 128);
                }
            }
            return utf8;
        };

        const stringToWords = (string) => {
            // Each character is 8 bits. Pack into an array of 32 bit numbers
            // then pad the end as specified by the MD5 standard: a single one
            // bit followed by as many zeros as need to make the length in bits
            // === 448 mod 512, then finally the length of the input, in bits,
            // as a 64 bit little-endian long int.
            const length = string.length;
            const blocks = [0];
            let i;
            let j;
            let k;
            for (i = 0, j = 0, k = 0; j < length; j += 1) {
                blocks[i] |= string.charCodeAt(j) << k;
                k += 8;
                if (k === 32) {
                    k = 0;
                    blocks[(i += 1)] = 0;
                }
            }
            blocks[i] |= 0x80 << k;
            i += 1;

            const padding = i + 16 - ((i + 2) % 16 || 16);
            for (; i < padding; i += 1) {
                blocks[i] = 0;
            }

            // Each char is 8 bits.
            blocks[i] = length << 3;
            blocks[i + 1] = length >>> 29;

            return blocks;
        };

        // Add unsigned 32 bit ints with overflow.
        const add = (a, b) => {
            const lsw = (a & 0xffff) + (b & 0xffff);
            const msw = (a >> 16) + (b >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xffff);
        };

        const leftRotate = (a, b) => (a << b) | (a >>> (32 - b));

        const hexCharacters = '0123456789abcdef';
        const hex = (number) => {
            let string = '';
            for (let i = 0; i < 32; i += 8) {
                string += hexCharacters[(number >> (i + 4)) & 0xf];
                string += hexCharacters[(number >> i) & 0xf];
            }
            return string;
        };

        return function () {
            const words = stringToWords(utf16To8(this));
            let h0 = 0x67452301;
            let h1 = 0xefcdab89;
            let h2 = 0x98badcfe;
            let h3 = 0x10325476;

            for (let j = 0, l = words.length; j < l; j += 16) {
                let a = h0;
                let b = h1;
                let c = h2;
                let d = h3;

                for (let i = 0; i < 64; i += 1) {
                    let f;
                    let g;
                    if (i < 16) {
                        f = (b & c) | (~b & d);
                        g = i;
                    } else if (i < 32) {
                        f = (d & b) | (~d & c);
                        g = (5 * i + 1) % 16;
                    } else if (i < 48) {
                        f = b ^ c ^ d;
                        g = (3 * i + 5) % 16;
                    } else {
                        f = c ^ (b | ~d);
                        g = (7 * i) % 16;
                    }
                    const temp = d;
                    d = c;
                    c = b;
                    b = add(
                        b,
                        leftRotate(
                            add(a, add(f, add(constants[i], words[j + g]))),
                            r[i],
                        ),
                    );
                    a = temp;
                }

                h0 = add(h0, a);
                h1 = add(h1, b);
                h2 = add(h2, c);
                h3 = add(h3, d);
            }

            return hex(h0) + hex(h1) + hex(h2) + hex(h3);
        };
    })(),
});

// TODO(cmorgan/modulify): do something about these exports: String#format,
// String#escapeHTML, String#escapeRegExp, String#capitalise,
// String#camelCase, String#hyphenate, String#hash, String#md5
