/*eslint-env node*/
module.exports = {
    ignorePatterns: ['/dist/**', '/node_modules/**'],
    env: {
        es6: true,
    },
    plugins: ['overture', 'import', 'simple-import-sort'],
    extends: ['eslint:recommended', 'prettier', 'plugin:overture/recommended'],
    parser: 'babel-eslint',
    parserOptions: {
        ecmaVersion: 9,
        sourceType: 'module',
    },
    rules: {
        // Possible errors
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-control-regex': 'off',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-prototype-builtins': 'off',
        'no-shadow': 'error',
        'no-useless-backreference': 'error',
        'require-atomic-updates': 'error',
        // Best practices
        'array-callback-return': 'error',
        'consistent-return': 'error',
        'curly': 'error',
        'default-case-last': 'error',
        'dot-notation': 'error',
        'eqeqeq': ['error', 'always', { null: 'ignore' }],
        'no-caller': 'error',
        'no-eval': 'error',
        'no-extra-bind': 'error',
        'no-floating-decimal': 'error',
        'no-implied-eval': 'error',
        'no-implicit-globals': 'error',
        'no-lone-blocks': 'error',
        'no-loop-func': 'error', // Not sure about this one; see if it hits
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-octal-escape': 'error',
        'no-return-assign': 'error',
        'no-script-url': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-unused-expressions': 'error',
        'no-useless-call': 'error',
        'no-useless-concat': 'error',
        'no-useless-escape': 'off',
        'no-useless-return': 'error',
        'prefer-regex-literals': 'error',
        'radix': 'error',
        // Variables
        'no-label-var': 'error',
        // Stylistic issues
        'one-var': ['error', 'never'],
        'one-var-declaration-per-line': 'error',
        // ECMAScript 6
        'no-var': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-const': 'error',
        // Import – slow disabled
        // 'import/no-unresolved': 'error',
        // 'import/named': 'error',
        // 'import/default': 'error',
        // 'import/namespace': 'error',
        'import/no-self-import': 'error',
        // 'import/no-cycle': 'error',
        'import/no-useless-path-segments': 'error',
        'import/export': 'error',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',
        'import/first': 'error',
        'import/exports-last': 'error',
        'import/no-duplicates': 'error',
        'import/no-namespace': 'error',
        'import/newline-after-import': 'error',
        'import/no-named-default': 'error',
        'import/no-default-export': 'error',
    },
    overrides: [
        {
            files: ['./source/**/*.js'],
            rules: {
                'simple-import-sort/imports': [
                    'error',
                    {
                        groups: [
                            // Anything that starts with a dot.
                            ['^\\.'],
                            // Side effect imports.
                            ['^\\u0000'],
                        ],
                    },
                ],
            },
        },
        {
            files: ['index.js'],
            rules: {
                'import/group-exports': 'off',
            },
        },
        {
            files: ['Overture.js'],
            rules: {
                'import/group-exports': 'off',
                'import/exports-last': 'off',
                'import/no-namespace': 'off',
            },
        },
    ],
};
