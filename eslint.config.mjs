import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        Document: 'readonly',
        DOMParser: 'readonly',
        Element: 'readonly',
        HTMLCollection: 'readonly',
        HTMLElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLOListElement: 'readonly',
        HTMLUListElement: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        Node: 'readonly',
        NodeJS: 'readonly',
        NodeList: 'readonly',
        React: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
        window: 'readonly',
        __DEV__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      ...prettierConfig.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'prefer-const': 'warn',
      'no-undef': 'warn',
      'no-unused-vars': 'off',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.test.{js,ts,tsx}', '**/*.spec.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        test: 'readonly',
      },
    },
  },
  {
    files: ['packages/react/src/i18n-context/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'gt-i18n',
              message:
                'In i18n-context, only import from gt-i18n/types, gt-i18n/internal, or gt-i18n/internal/types.',
            },
          ],
          patterns: [
            {
              group: ['gt-i18n/*', '!gt-i18n/types', '!gt-i18n/internal'],
              message:
                'In i18n-context, only import from gt-i18n/types, gt-i18n/internal, or gt-i18n/internal/types. Importing from gt-i18n is likely to break i18n context.',
            },
            {
              group: ['gt-i18n/*/*', '!gt-i18n/internal/types'],
              message:
                'In i18n-context, only import from gt-i18n/types, gt-i18n/internal, or gt-i18n/internal/types. Importing from gt-i18n is likely to break i18n context.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'dist/',
      '**/dist/**',
      'node_modules/',
      'coverage/',
      '**/*.d.ts',
      '**/rollup.config.*',
      'tests/seeds/**/*',
    ],
  },
];
