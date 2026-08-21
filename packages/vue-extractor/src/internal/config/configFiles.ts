/** Vite's standard config filenames in lookup precedence order. */
export const VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
] as const;

/** Nuxt's standard config filenames in lookup precedence order. */
export const NUXT_CONFIG_FILES = [
  'nuxt.config.js',
  'nuxt.config.ts',
  'nuxt.config.mjs',
  'nuxt.config.cjs',
  'nuxt.config.mts',
  'nuxt.config.cts',
] as const;

/** JavaScript and TypeScript extensions accepted for an explicit Vite config. */
export const VITE_CONFIG_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);
