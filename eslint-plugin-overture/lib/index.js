module.exports = {
    rules: {
        'class-extends': require('./rules/class-extends'),
        'get-and-get-from-path-usage': require('./rules/get-and-get-from-path-usage'),
        'no-new-class': require('./rules/no-new-class'),
        'object-shorthand': require('./rules/object-shorthand'),
        'when-and-unless-usage': require('./rules/when-and-unless-usage'),
    },
    configs: {
        recommended: {
            plugins: ['overture'],
            rules: {
                // Replace object-shorthand with our own one that handles
                // mandatory constructors properly.
                'object-shorthand': 'off',
                'overture/object-shorthand': [
                    'error',
                    'always',
                    {
                        constructors: {
                            pattern: '^(?:init|constructor)$'
                        }
                    }
                ],

                'overture/class-extends': 'error',
                'overture/get-and-get-from-path-usage': 'error',
                'overture/no-new-class': 'error',
                'overture/when-and-unless-usage': 'error',
            },
        },
    },
};
