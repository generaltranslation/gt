/**
 * Recommended ESLint configuration for GT-Next
 */

export const recommended = {
  plugins: ['gt-next'],
  rules: {
    'gt-next/no-unwrapped-dynamic-content': 'warn',
    'gt-next/no-dynamic-translation-strings': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};