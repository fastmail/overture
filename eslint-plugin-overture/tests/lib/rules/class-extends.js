/* eslint-disable max-len */
const rule = require('../../../lib/rules/class-extends');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('class-extends', rule, {
    valid: [
        'Class({Extends: Obj})',
    ],

    invalid: [
        {
            code: 'Class()',
            errors: [{
                message: 'Class() requires one argument, params',
                type: 'CallExpression',
            }],
        },
        {
            code: 'Class(params)',
            errors: [{
                message: 'Class() params argument should be an object literal',
                type: 'Identifier',
            }],
        },
        {
            code: 'Class({hello: 2})',
            errors: [{
                message: 'Class() params should include Extends; otherwise use ES6 class syntax',
                type: 'ObjectExpression',
            }],
        },
    ],
});
