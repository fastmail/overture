const config = module.exports = { ...require('../.eslintrc.js') };

Object.assign(config, {
    env: {
        node: true,
        es6: true,
    },
    extends: [
        'eslint:recommended',
    ],
    rules: {
        ...config.rules,

        'global-require': 'off',
        // They’re probably not actually useless.
        'no-useless-return': 'off',

        // Experimenting with a code style closer to what autoformatters suggest.

        'space-before-function-paren': 'off',
        'func-style': ['error', 'declaration'],
        // This value is supposed to be eslint’s default, but for some reason I seem
        // to need to specify it, rather than just deleting it? Meh.
        'operator-linebreak': [
            'error',
            'after',
            {
                overrides: {
                    '?': 'before',
                    ':': 'before',
                },
            },
        ],
    },
});

delete config.parserOptions;
