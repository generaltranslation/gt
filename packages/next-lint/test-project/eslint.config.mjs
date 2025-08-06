import typescript from "@typescript-eslint/eslint-plugin";

import gtNext from '@generaltranslation/gt-next-lint';
export default [
  
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'gt-next': gtNext,
    },
    rules: {
      'gt-next/no-unwrapped-dynamic-content': 'warn',
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
{
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
];