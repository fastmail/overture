import { compileTranslation, parseICUString } from './compile-translation';

/*globals test, expect */

test('Ordinary strings', () => {
    expect(parseICUString('Hello, world')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 12,

            content: 'Hello, world',
        },
    ]);
    expect(parseICUString('Hello, 世界')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 9,

            content: 'Hello, 世界',
        },
    ]);
});

test('Escaped strings', () => {
    expect(parseICUString("This '{isn''t}' obvi'ous, {eh}'")).toEqual([
        {
            type: 'string',

            start: 0,
            end: 30,

            content: "This {isn't} obvious, {eh}",
        },
    ]);

    expect(parseICUString('Created new contact "{value1}"')).toEqual([
        { content: 'Created new contact "', end: 21, start: 0, type: 'string' },
        {
            end: 29,
            start: 21,
            type: 'variable',
            value: 'value1',
        },
        {
            content: '"',
            end: 30,
            start: 29,
            type: 'string',
        },
    ]);

    // '' always === '
    expect(parseICUString("This '{isn''t}' ''obvious''")).toEqual([
        {
            type: 'string',

            start: 0,
            end: 24,

            content: "This {isn't} 'obvious'",
        },
    ]);

    // backslashes
    expect(parseICUString('Hello, \\" world')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 15,

            content: 'Hello, \\" world',
        },
    ]);

    expect(parseICUString('Hello, \\"{world}\\"')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 9,

            content: 'Hello, \\"',
        },
        {
            type: 'variable',

            start: 9,
            end: 16,

            value: 'world',
        },
        {
            type: 'string',

            start: 16,
            end: 18,

            content: '\\"',
        },
    ]);
});

test('Variable substitution', () => {
    expect(parseICUString('Hello, {world}')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 7,

            content: 'Hello, ',
        },
        {
            type: 'variable',

            start: 7,
            end: 14,

            value: 'world',
        },
    ]);

    expect(parseICUString('Hello, {world} {how} are you')).toEqual([
        {
            type: 'string',

            start: 0,
            end: 7,

            content: 'Hello, ',
        },
        {
            type: 'variable',

            start: 7,
            end: 14,

            value: 'world',
        },
        {
            type: 'string',

            end: 15,
            start: 14,

            content: ' ',
        },
        {
            type: 'variable',
            start: 15,
            end: 20,

            value: 'how',
        },
        {
            type: 'string',

            end: 28,
            start: 20,

            content: ' are you',
        },
    ]);

    // arbitrary whitespace, out of order variable names, and the same variable
    // name used multiple times
    expect(
        parseICUString('   😎 \n 😎 \n {value2} \n {value1}{value1} {value1} '),
    ).toEqual([
        {
            type: 'string',

            start: 0,
            end: 13,

            content: '   😎 \n 😎 \n ',
        },
        {
            type: 'variable',

            start: 13,
            end: 21,

            value: 'value2',
        },
        {
            type: 'string',

            start: 21,
            end: 24,

            content: ' \n ',
        },
        {
            type: 'variable',

            start: 24,
            end: 32,

            value: 'value1',
        },
        {
            type: 'variable',

            start: 32,
            end: 40,

            value: 'value1',
        },
        {
            type: 'string',

            start: 40,
            end: 41,

            content: ' ',
        },
        {
            type: 'variable',

            start: 41,
            end: 49,

            value: 'value1',
        },
        {
            content: ' ',
            end: 50,
            start: 49,
            type: 'string',
        },
    ]);
});

test('Plural rules', () => {
    expect(
        parseICUString(
            '{value1, plural, one {# hour} other {# hours} =0 {}} {value2, plural, one {# minute} other {# minutes} =0 {}}',
        ),
    ).toEqual([
        {
            type: 'plural',

            start: 0,
            end: 52,

            string: 'value1, plural, one {# hour} other {# hours} =0 {}',
            value: 'value1',
            substitutions: {
                'one': '# hour',
                'other': '# hours',
                '=0': '',
            },
        },
        {
            type: 'string',

            start: 52,
            end: 53,

            content: ' ',
        },
        {
            type: 'plural',

            start: 53,
            end: 109,

            string: 'value2, plural, one {# minute} other {# minutes} =0 {}',
            value: 'value2',
            substitutions: {
                'one': '# minute',
                'other': '# minutes',
                '=0': '',
            },
        },
    ]);

    // arbitrary rules
    expect(parseICUString('{😎, 😎, 😎 {😎}}')).toEqual([
        {
            type: '😎',

            start: 0,
            end: 17,

            string: '😎, 😎, 😎 {😎}',
            value: '😎',
            substitutions: {
                '😎': '😎',
            },
        },
    ]);

    // Escaping within a substitution
    expect(parseICUString("{foo, bar, baz {'{'''quxx}}")).toEqual([
        {
            type: 'bar',

            start: 0,
            end: 25,

            string: "foo, bar, baz {{'quxx}",
            value: 'foo',
            substitutions: {
                baz: "{'quxx",
            },
        },
    ]);
});

test('Compile translation', () => {
    // Basic strings
    expect(compileTranslation({ translation: 'Copy to Clipboard' })).toBe(
        '(x,a) => "Copy to Clipboard"',
    );

    // tricky escaping
    expect(
        compileTranslation({ translation: 'Created new contact "{value1}"' }),
    ).toBe('(x,a) => x._lr(["Created new contact \\"",a[0],"\\""])');

    // variables
    expect(
        compileTranslation({
            translation:
                'We have your {value1} card ending in {value2} saved for future renewals.',
        }),
    ).toBe(
        '(x,a) => x._lr(["We have your ",a[0]," card ending in ",a[1]," saved for future renewals."])',
    );

    // plural rules
    expect(
        compileTranslation({
            translation:
                '{value1, plural, one {Your user} other {All # users}} will be upgraded from {value2} to {value3}.',
        }),
    ).toBe(
        '(x,a) => x._lr([x.p(a[0],"Your user","All %n users")," will be upgraded from ",a[1]," to ",a[2],"."])',
    );

    // =0 string
    expect(
        compileTranslation({
            translation:
                'You have {value1, plural, one {1 user} other {# users} =0 {no users}} and {value2, plural, one {1 alias} other {# aliases} =0 {no aliases}} at this domain.',
        }),
    ).toBe(
        '(x,a) => x._lr(["You have ",(a[0] === 0 ? "no users" : x.p(a[0],"1 user","%n users"))," and ",(a[1] === 0 ? "no aliases" : x.p(a[1],"1 alias","%n aliases"))," at this domain."])',
    );

    // arbitrary =n amounts
    expect(
        compileTranslation({
            translation:
                'Your favorite number of cats to have is {value1, plural, =0 {no cats 😧} =42 {THE BEST NUMBER OF CATS} one {# cat} other {# cats}}.',
        }),
    ).toBe(
        '(x,a) => x._lr(["Your favorite number of cats to have is ",(a[0] === 0 ? "no cats 😧" : a[0] === 42 ? "THE BEST NUMBER OF CATS" : x.p(a[0],"%n cat","%n cats")),"."])',
    );
});

test('Compile translation knows when fallback used', () => {
    let fallbackRules = {
        needsFallbackPluralisationFunction: true,
    };

    // normal operation:
    expect(
        compileTranslation(
            {
                translation:
                    'Your favorite number of cats to have is {value1, plural, =0 {no cats 😧} =42 {THE BEST NUMBER OF CATS} one {# cat} other {# cats}}.',
            },
            fallbackRules,
        ),
    ).toBe(
        '(x,a) => x._lr(["Your favorite number of cats to have is ",(a[0] === 0 ? "no cats 😧" : a[0] === 42 ? "THE BEST NUMBER OF CATS" : x.p(a[0],"%n cat","%n cats")),"."])',
    );

    // No translation, and we need a fallback (note: x.f)
    expect(
        compileTranslation(
            {
                string: 'Your favorite number of cats to have is {value1, plural, =0 {no cats 😧} =42 {THE BEST NUMBER OF CATS} one {# cat} other {# cats}}.',
            },
            fallbackRules,
        ),
    ).toBe(
        '(x,a) => x._lr(["Your favorite number of cats to have is ",(a[0] === 0 ? "no cats 😧" : a[0] === 42 ? "THE BEST NUMBER OF CATS" : x.f(a[0],"%n cat","%n cats")),"."])',
    );

    // some languages use the same pluralisation rules as English, so we don't
    // need a fallback function:
    fallbackRules = {
        needsFallbackPluralisationFunction: false,
    };

    expect(
        compileTranslation(
            {
                string: 'Your favorite number of cats to have is {value1, plural, =0 {no cats 😧} =42 {THE BEST NUMBER OF CATS} one {# cat} other {# cats}}.',
            },
            fallbackRules,
        ),
    ).toBe(
        '(x,a) => x._lr(["Your favorite number of cats to have is ",(a[0] === 0 ? "no cats 😧" : a[0] === 42 ? "THE BEST NUMBER OF CATS" : x.p(a[0],"%n cat","%n cats")),"."])',
    );
});
