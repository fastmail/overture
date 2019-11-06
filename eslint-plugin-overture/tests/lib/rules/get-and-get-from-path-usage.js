/* eslint-disable max-len */
const rule = require('../../../lib/rules/get-and-get-from-path-usage');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('get-and-get-from-path-usage', rule, {
    valid: [
        'foo.get(bar)',
        'foo.getFromPath(bar)',
        'foo.get("bar")',
        'foo.getFromPath("bar.baz")',
    ],

    invalid: [
        {
            code: 'foo.get("bar.baz")',
            errors: [{
                message: '.get() takes a key, not a path; use .getFromPath() instead',
                type: 'CallExpression',
            }],
        },
        {
            code: 'foo.getFromPath("bar")',
            errors: [{
                message: '.getFromPath() takes a path, but this is just a key; use .get() instead',
                type: 'CallExpression',
            }],
        },
    ],
});
