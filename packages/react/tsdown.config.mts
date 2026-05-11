import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const configs = createTsdownConfig(
  [
    'src/index.ts',
    'src/internal.ts',
    'src/client.ts',
    'src/browser.ts',
    'src/browser-types.ts',
    'src/macros.ts',
  ],
  {
    neverBundle: [
      /^react($|\/)/,
      /^react-dom($|\/)/,
      /^@generaltranslation\/react-core($|\/)/,
    ],
  }
);

export default defineConfig([
  {
    ...configs[0],
    define: {
      'import.meta.env': '{}',
    },
  },
  configs[1],
]);
