/* eslint-disable max-len */
const rule = require('../../../lib/rules/switch-view-usage');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('switch-view-usage', rule, {
    valid: [
        'something_else.when(this, "property").show(foo)',
        'something_else.when(this, "property").show(foo).end()',
        'when(this, "property").show(foo).end()',
        'when(this, "property", invert).show([]).otherwise(bar).end()',
        'unless(this, "property", function(x) { return x + 1; }).show([]).end()',
        'unless(this, "property").show(baz).otherwise([]).end()',
        'choose(this, "property").case(0, []).end()',
        'choose(this, "property", transform).case(0, []).case(1, []).end()',
        'choose(this, "property").case(0, []).case(1, []).case(2, []).end()',
    ],

    invalid: [
        ['unless("property").show(a).end()', 'unless() expects two or three arguments, got 1'],
        ['when(this, "property").somethingWeird()', "expected 'when' call to be followed by .show()"],
        ['unless(this, "property", invert).show([]).somethingWeird()', "expected .end() or .otherwise(...) on 'unless' construct, not .somethingWeird"],
        ['when(this, "property").show([]).otherwise([]).somethingWeird()', "expected .end() on 'when' construct, not .somethingWeird"],
        ['when(this, "property", invert).show([])', ".end() missing on 'when' construct"],
        ['unless(this, "property").then([]).end()', ".show() misspelled as .then() in 'unless' construct"],
        ['choose("property").case(0, []).end()', 'choose() expects two or three arguments, got 1'],
        ['choose(this, "property").show([]).end()', "expected 'choose' call to be followed by .case()"],
        ['choose(this, "property", transform).case(0, []).otherwise([]).end()', "expected .end() or .case(...) on 'choose' construct, not .otherwise"],
    ].map( ([code, message]) => ({
        code,
        errors: [{
            message,
            type: 'CallExpression',
        }],
    })),
});
