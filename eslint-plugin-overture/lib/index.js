module.exports = {
    rules: {
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

                'overture/when-and-unless-usage': 'error',
            },
        },
    },
};
