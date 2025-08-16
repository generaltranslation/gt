/**
 * Recommended ESLint configuration for GT-Next
 */

export const recommended = {
  plugins: ['gt-next'],
  rules: {
    'gt-next/no-dynamic-jsx': true,
    'gt-next/no-dynamic-string': true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
