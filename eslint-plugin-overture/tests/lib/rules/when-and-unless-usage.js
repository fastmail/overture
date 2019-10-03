/* eslint-disable max-len */
const rule = require('../../../lib/rules/when-and-unless-usage');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('when-and-unless-usage', rule, {
    valid: [
        'something_else.when(this, "property").show(foo)',
        'something_else.when(this, "property").show(foo).end()',
        'when(this, "property").show(foo).end()',
        'when(this, "property", invert).show([]).otherwise(bar).end()',
        'unless(this, "property", function(x) { return x + 1; }).show([]).end()',
        'unless(this, "property").show(baz).otherwise([]).end()',
    ],

    invalid: [
        ['unless("property").show(a).end()', "unless() expects two or three arguments, got 1"],
        ['when(this, "property").somethingWeird()', "expected 'when' call to be followed by .show()"],
        ['when(this, "property").show([])', ".end() missing on 'when' construct"],
        ['unless(this, "property").then([]).end()', ".show() misspelled as .then() in 'unless' construct"],
    ].map( ([code, message]) => {
        return {
            code,
            errors: [{
                message,
                type: 'CallExpression',
            }],
        };
    }),
});
