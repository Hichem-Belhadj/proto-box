// eslint.config.js (flat config)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // 1) Ignore net
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.angular/**',            // <-- important
      '**/.angular/**/*',          // <-- important (belt & suspenders)
      '**/*.spec.ts',
      '**/.eslintrc.*',
      '**/eslint.config.*',
      '**/*.config.*',
    ],
  },

  // 2) JS pur (espree)
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node } },
    // Par sécurité: coupe toute règle TS sur JS
    rules: {
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },

  // 3) TS avec typage (type-aware)
  // On borne explicitement aux extensions TS
  ...tseslint.configs.recommendedTypeChecked.map(cfg => ({
    ...cfg,
    files: ['**/*.{ts,tsx,cts,mts}'],
  })),

  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],          // doit pointer vers le tsconfig racine
        tsconfigRootDir: import.meta.dirname,  // flat config ESM
      },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true, allowAny: true },
      ],
    },
  },

  eslintConfigPrettier,
];
