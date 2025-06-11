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

export const DAG_IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/.cache/**',
  '**/.nuxt/**',
  '**/.vite/**',
  '**/.turbo/**',
  '**/.locadex/**',
];

export const DAG_IGNORED_EXTENSIONS = [
  '.map', // Source maps
  '.map.js', // Source maps
  '.min.js', // Minified JavaScript
  '.min.ts', // Minified TypeScript
  '.spec.js', // Test files
  '.spec.ts',
  '.test.js',
  '.test.ts',
  '.stories.js', // Storybook files
  '.stories.ts',
  '.config.js', // Various config files (though some might be relevant)
  '.config.ts',
  '.d.ts',
  '.e2e.js', // End-to-end tests
  '.e2e.ts', // End-to-end tests
  '.setup.js', // Test setup files
  '.setup.ts', // Test setup files
  '.mock.js', // Mock files
  '.mock.ts', // Mock files
  '.fixture.js', // Test fixtures
  '.fixture.ts', // Test fixtures
];

export const CLAUDE_CODE_VERSION = '1.0.16';
