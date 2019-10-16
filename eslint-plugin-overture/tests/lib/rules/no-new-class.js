const rule = require('../../../lib/rules/no-new-class');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('no-new-class', rule, {
    valid: [
        'Class()',
    ],

    invalid: [
        {
            code: 'new Class()',
            errors: [
                {
                    message: 'Do not use Class as a constructor.',
                    type: 'NewExpression',
                },
            ],
        },
    ],
});
