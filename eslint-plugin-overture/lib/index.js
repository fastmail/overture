module.exports = {
    rules: {
        'when-and-unless-usage': require('./rules/when-and-unless-usage'),
    },
    configs: {
        recommended: {
            plugins: ['overture'],
            rules: {
                'overture/when-and-unless-usage': 'error',
            },
        },
    },
};
