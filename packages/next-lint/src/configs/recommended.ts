/**
 * Recommended ESLint configuration for GT-Next
 */

export const recommended = {
  plugins: ['gt-next'],
  rules: {
    'gt-next/no-dynamic-jsx': 'warn',
    'gt-next/no-dynamic-string': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};