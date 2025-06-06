export const EXCLUDED_DIRS = [
  './node_modules',
  './.git',
  './.locadex',
  './.next',
  './dist',
  './build',
  './out',
  './public',
  './static',
];

export const DAG_IGNORED_FILES = [
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'next.config.mts',
  'next.config.cjs',
  'next.config.cts',
  'tailwind.config.js',
  'webpack.config.js',
];

export const DAG_IGNORED_EXTENSIONS = ['.css', '.scss', '.sass', '.less'];
