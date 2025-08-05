// Test ESLint configuration for GT-Next plugin
import gtNext from '../dist/index.js';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'gt-next': gtNext,
    },
    rules: {
      'gt-next/no-unwrapped-dynamic-content': 'error',
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
