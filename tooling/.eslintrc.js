module.exports = {
    env: {
        node: true,
        es6: true,
    },
    extends: ['eslint:recommended', 'prettier'],
    parser: 'babel-eslint',
    parserOptions: {
        ecmaVersion: 9,
        sourceType: 'module',
    },
    rules: {
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-empty': ['error', { allowEmptyCatch: true }],
    },
};
