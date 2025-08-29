import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '**/*.spec.ts',
            'coverage/**',
            '**/.eslintrc.*',
            '**/eslint.config.*',
            '**/*.config.*',
        ],
    },

    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: ['./tsconfig.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {...globals.node},
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn:
                        {
                            attributes: false,
                            arguments: false
                        }
                }],
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                {
                    allowNumber: true,
                    allowBoolean: true,
                    allowNullish: true,
                    allowAny: true
                },
            ]
        },
    },

    {
        files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        languageOptions: {globals: {...globals.node}},
    },

    eslintConfigPrettier,
];
