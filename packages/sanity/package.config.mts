import { defineConfig } from '@sanity/pkg-utils';

export default defineConfig({
  dist: 'dist',
  tsconfig: 'tsconfig.dist.json',

  // Remove this block to enable strict export validation
  extract: {
    checkTypes: false,
    rules: {
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
      'ae-missing-release-tag': 'off',
    },
  },
  strictOptions: {
    preferModuleType: 'off',
  },
});
