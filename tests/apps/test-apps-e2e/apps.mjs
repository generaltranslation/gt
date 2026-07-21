export const apps = Object.freeze({
  'next-app-router': {
    packageName: 'gt-test-next-app-router',
    entryPackage: 'gt-next',
    kind: 'next',
    baseURL: 'http://localhost:3000',
    command: 'pnpm --filter gt-test-next-app-router dev',
    readyPath: '/',
  },
  'next-app-router-dictionary': {
    packageName: 'gt-test-next-app-router-dictionary',
    entryPackage: 'gt-next',
    kind: 'next-dictionary',
    baseURL: 'http://localhost:3000',
    command: 'pnpm --filter gt-test-next-app-router-dictionary dev',
    readyPath: '/',
  },
  'next-app-router-locale-routing': {
    packageName: 'gt-test-next-app-router-locale-routing',
    entryPackage: 'gt-next',
    kind: 'next-routing',
    baseURL: 'http://localhost:3000',
    command: 'pnpm --filter gt-test-next-app-router-locale-routing dev',
    readyPath: '/',
  },
  'next-app-router-locale-routing-ssg': {
    packageName: 'gt-test-next-app-router-locale-routing-ssg',
    entryPackage: 'gt-next',
    kind: 'next-routing',
    baseURL: 'http://localhost:3000',
    command: 'pnpm --filter gt-test-next-app-router-locale-routing-ssg dev',
    readyPath: '/',
  },
  'next-app-router-locale-routing-use-cache': {
    packageName: 'gt-test-next-app-router-locale-routing-use-cache',
    entryPackage: 'gt-next',
    kind: 'next-routing-cache',
    baseURL: 'http://localhost:3000',
    command:
      'pnpm --filter gt-test-next-app-router-locale-routing-use-cache dev',
    readyPath: '/',
  },
  'next-pages-router': {
    packageName: 'gt-test-next-pages-router',
    entryPackage: 'gt-next',
    kind: 'next-pages',
    baseURL: 'http://localhost:3000',
    command: 'pnpm --filter gt-test-next-pages-router dev',
    readyPath: '/',
  },
  'tanstack-start': {
    packageName: 'gt-test-tanstack-start',
    entryPackage: 'gt-tanstack-start',
    kind: 'tanstack',
    baseURL: 'http://localhost:5273',
    command:
      'pnpm --filter gt-test-tanstack-start exec vite dev --port 5273 --strictPort',
    readyPath: '/',
  },
  'vite-react': {
    packageName: 'gt-test-vite-react',
    entryPackage: 'gt-react',
    kind: 'react',
    baseURL: 'http://localhost:5174',
    command: 'pnpm --filter gt-test-vite-react dev',
    readyPath: '/',
  },
  'webpack-react': {
    packageName: 'gt-test-webpack-react',
    entryPackage: 'gt-react',
    kind: 'react',
    baseURL: 'http://127.0.0.1:5175',
    command: 'pnpm --filter gt-test-webpack-react dev',
    readyPath: '/',
  },
  'rollup-react': {
    packageName: 'gt-test-rollup-react',
    entryPackage: 'gt-react',
    kind: 'react',
    baseURL: 'http://127.0.0.1:5176',
    command:
      'pnpm --filter gt-test-rollup-react build && pnpm --filter gt-test-rollup-react dev',
    readyPath: '/',
  },
  'rolldown-react': {
    packageName: 'gt-test-rolldown-react',
    entryPackage: 'gt-react',
    kind: 'react',
    baseURL: 'http://127.0.0.1:5177',
    command:
      'pnpm --filter gt-test-rolldown-react build && pnpm --filter gt-test-rolldown-react dev',
    readyPath: '/',
  },
  'esbuild-react': {
    packageName: 'gt-test-esbuild-react',
    entryPackage: 'gt-react',
    kind: 'react',
    baseURL: 'http://127.0.0.1:5178',
    command: 'pnpm --filter gt-test-esbuild-react dev',
    readyPath: '/',
  },
  'gt-node-express': {
    packageName: 'gt-test-node-express',
    entryPackage: 'gt-node',
    kind: 'node',
    baseURL: 'http://127.0.0.1:3001',
    command: 'pnpm --filter gt-test-node-express dev',
    readyPath: '/api/status',
  },
});

/**
 * @param {string | undefined} name
 */
export function getApp(name) {
  if (!name || !Object.hasOwn(apps, name)) {
    throw new Error(
      `Unknown GT test app ${JSON.stringify(name)}. Expected one of: ${Object.keys(apps).join(', ')}`
    );
  }

  return apps[/** @type {keyof typeof apps} */ (name)];
}
