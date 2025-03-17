import pluginJs from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import overture from 'eslint-plugin-overture';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
    pluginJs.configs.recommended,
    {
        plugins: {
            'import': pluginImport,
            overture,
            'simple-import-sort': simpleImportSort,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                DESKTOP: false,
                MOBILE: false,
                FASTMAIL: false,
                PRODUCTION: false,
                VITE_FASTMAILDEV: false,
                VITE_PROD: false,
                DYNAMO: false,
                INABOX: false,
                LEGACY: false,
            },
        },
        rules: {
            'no-constant-condition': [
                'error',
                {
                    checkLoops: false,
                },
            ],
            'no-control-regex': 'off',
            'no-empty': [
                'error',
                {
                    allowEmptyCatch: true,
                },
            ],
            'no-prototype-builtins': 'off',
            'no-shadow': 'error',
            'no-useless-backreference': 'error',
            'array-callback-return': 'error',
            'consistent-return': 'error',
            'curly': 'error',
            'default-case-last': 'error',
            'dot-notation': 'error',
            'eqeqeq': [
                'error',
                'always',
                {
                    null: 'ignore',
                },
            ],
            'no-caller': 'error',
            'no-eval': 'error',
            'no-extra-bind': 'error',
            'no-floating-decimal': 'error',
            'no-implied-eval': 'error',
            'no-implicit-globals': 'error',
            'no-lone-blocks': 'error',
            'no-new-func': 'error',
            'no-new-wrappers': 'error',
            'no-octal-escape': 'error',
            'no-plusplus': 'error',
            'no-return-assign': 'error',
            'no-script-url': 'error',
            'no-self-compare': 'error',
            'no-sequences': 'error',
            'no-throw-literal': 'error',
            'no-unmodified-loop-condition': 'error',
            'no-unused-expressions': 'error',
            'no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'after-used',
                    caughtErrors: 'none',
                    ignoreRestSiblings: false,
                    reportUsedIgnorePattern: false,
                },
            ],
            'no-useless-call': 'error',
            'no-useless-concat': 'error',
            'no-useless-escape': 'off',
            'no-useless-return': 'error',
            'prefer-regex-literals': 'error',
            'radix': 'error',
            'no-label-var': 'error',
            'one-var': ['error', 'never'],
            'one-var-declaration-per-line': 'error',
            'no-var': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-const': 'error',

            'import/no-self-import': 'error',
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
            'import/group-exports': 'off',

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

            'object-shorthand': 'off',
            'overture/object-shorthand': [
                'error',
                'always',
                {
                    constructors: {
                        pattern: '^(?:init|constructor)$',
                    },
                },
            ],
            'overture/class-extends': 'error',
            'overture/class-name': 'error',
            'overture/get-and-get-from-path-usage': 'error',
            'overture/no-new-class': 'error',
            'overture/switch-view-usage': 'error',
        },
    },
    {
        files: ['**/Overture.js'],
        rules: {
            'import/exports-last': 'off',
            'import/no-namespace': 'off',
        },
    },
];
