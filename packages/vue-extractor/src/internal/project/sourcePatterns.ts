/** Conventional source directories searched by default for Vue applications. */
export const DEFAULT_VUE_SOURCE_DIRECTORIES = [
  'src',
  'app',
  'pages',
  'components',
  'composables',
  'layers',
  'layouts',
  'middleware',
  'modules',
  'plugins',
  'server',
  'shared',
  'stores',
  'utils',
  'views',
] as const;

/** Default Vue source patterns, including conventional Vue and Nuxt folders. */
export const DEFAULT_VUE_SOURCE_PATTERNS = [
  '*.vue',
  'src/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'app/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'pages/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'components/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  '{composables,layers,layouts,middleware,modules,plugins,server,shared,stores,utils,views}/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
] as const;
