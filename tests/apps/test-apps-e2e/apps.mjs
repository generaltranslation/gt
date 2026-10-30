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
  'tanstack-start-locale-routing': {
    packageName: 'gt-test-tanstack-start',
    entryPackage: 'gt-tanstack-start',
    kind: 'tanstack-routing',
    baseURL: 'http://localhost:5275',
    command:
      'GT_TEST_CONFIG=gt.config.locale-routing.json pnpm --filter gt-test-tanstack-start exec vite dev --port 5275 --strictPort',
    readyPath: '/',
  },
  'tanstack-start-spa': {
    packageName: 'gt-test-tanstack-start',
    entryPackage: 'gt-tanstack-start',
    kind: 'tanstack-spa',
    baseURL: 'http://localhost:5277',
    command:
      'GT_TEST_SPA=1 GT_TEST_CONFIG=gt.config.locale-routing.json pnpm --filter gt-test-tanstack-start exec vite build && node tests/apps/test-apps-e2e/serveSpaShell.mjs tests/apps/tanstack-start/dist/client 5277',
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
  'vite-vue': {
    packageName: 'gt-test-vite-vue',
    entryPackage: 'gt-vue',
    kind: 'vue-spa',
    baseURL: 'http://127.0.0.1:5179',
    command: 'pnpm --filter gt-test-vite-vue test:e2e:serve',
    readyPath: '/',
  },
  sveltekit: {
    packageName: 'gt-test-sveltekit',
    entryPackage: 'gt-svelte',
    kind: 'sveltekit',
    baseURL: 'http://127.0.0.1:5181',
    command: 'pnpm --filter gt-test-sveltekit test:e2e:serve',
    readyPath: '/',
  },
  'sveltekit-3': {
    packageName: 'gt-test-sveltekit-3',
    entryPackage: 'gt-svelte',
    kind: 'sveltekit-3',
    baseURL: 'http://127.0.0.1:5183',
    command: 'pnpm --filter gt-test-sveltekit-3 test:e2e:serve',
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
  // Locale twins (files.gt.splitting: 'locale-twins'): production builds,
  // tested by e2e/twins.spec.ts. See servers/locale-twins-spa-server.mjs and
  // servers/locale-twins-tanstack-server.mjs.
  'vite-react-twins': {
    packageName: 'gt-test-vite-react-twins',
    entryPackage: 'gt-react',
    kind: 'react-twins',
    baseURL: 'http://127.0.0.1:4180',
    command:
      'pnpm --filter gt-test-vite-react-twins build && node tests/apps/test-apps-e2e/servers/locale-twins-spa-server.mjs --app tests/apps/vite-react-twins --port 4180 --mode static',
    readyPath: '/',
    twins: {
      appDir: 'tests/apps/vite-react-twins',
      clientDir: 'dist',
      translationsDir: 'src/_gt',
      serving: 'static',
      lazyRoute: '/harbor-guide',
    },
  },
  'vite-react-twins-server': {
    packageName: 'gt-test-vite-react-twins',
    entryPackage: 'gt-react',
    kind: 'react-twins',
    baseURL: 'http://127.0.0.1:4181',
    command:
      'pnpm --filter gt-test-vite-react-twins build && node tests/apps/test-apps-e2e/servers/locale-twins-spa-server.mjs --app tests/apps/vite-react-twins --port 4181 --mode server-helper',
    readyPath: '/',
    twins: {
      appDir: 'tests/apps/vite-react-twins',
      clientDir: 'dist',
      translationsDir: 'src/_gt',
      serving: 'server-helper',
      lazyRoute: '/harbor-guide',
    },
  },
  'vite7-react-twins': {
    packageName: 'gt-test-vite7-react-twins',
    entryPackage: 'gt-react',
    kind: 'react-twins',
    baseURL: 'http://127.0.0.1:4182',
    command:
      'pnpm --filter gt-test-vite7-react-twins build && node tests/apps/test-apps-e2e/servers/locale-twins-spa-server.mjs --app tests/apps/vite7-react-twins --port 4182 --mode static',
    readyPath: '/',
    twins: {
      appDir: 'tests/apps/vite7-react-twins',
      clientDir: 'dist',
      translationsDir: 'src/_gt',
      serving: 'static',
      lazyRoute: '/harbor-guide',
    },
  },
  'tanstack-start-twins': {
    packageName: 'gt-test-tanstack-start-twins',
    entryPackage: 'gt-tanstack-start',
    kind: 'tanstack-twins',
    baseURL: 'http://127.0.0.1:4183',
    command:
      'pnpm --filter gt-test-tanstack-start-twins build && node tests/apps/test-apps-e2e/servers/locale-twins-tanstack-server.mjs --app tests/apps/tanstack-start-twins --port 4183 --mismatch-control',
    readyPath: '/',
    twins: {
      appDir: 'tests/apps/tanstack-start-twins',
      clientDir: 'dist/client',
      translationsDir: 'src/_gt',
      serving: 'tanstack',
      lazyRoute: '/harbor-guide',
      clientOnlyRoute: '/signal-log',
      loaderRoute: '/harbor-notices',
      mismatchControlParam: '__gt_twin_locale',
    },
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
