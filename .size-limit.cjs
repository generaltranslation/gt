const nodePlatform = (config) => ({ ...config, platform: 'node' });

const reactPeerIgnore = ['react', 'react-dom'];
const reactNativePeerIgnore = ['react', 'react-native'];
const nextPeerIgnore = ['next', 'react', 'react-dom', 'server-only'];
const tanstackPeerIgnore = ['@tanstack/react-start', 'react', 'react-dom'];

const entry = (name, path, limit, options = {}) => ({
  name,
  path,
  limit,
  brotli: true,
  ...options,
});

const nodeEntry = (name, path, limit, options = {}) =>
  entry(name, path, limit, {
    modifyEsbuildConfig: nodePlatform,
    ...options,
  });

const core = (name, file) =>
  entry(name, `packages/core/dist/${file}.mjs`, '30 kB');

const format = (name, file) =>
  entry(name, `packages/format/dist/${file}.mjs`, '15 kB');

const i18n = (name, file) =>
  entry(name, `packages/i18n/dist/${file}.mjs`, '35 kB');

const reactCore = (name, file) =>
  entry(name, `packages/react-core/dist/${file}.mjs`, '48 kB', {
    ignore: ['react'],
  });

const react = (name, file, limit = '50 kB') =>
  entry(name, `packages/react/dist/${file}.mjs`, limit, {
    ignore: reactPeerIgnore,
  });

const vue = (name, file, limit = '15 kB', options = {}) =>
  entry(name, `packages/vue/dist/${file}.mjs`, limit, {
    ignore: ['vue'],
    ...options,
  });

const reactNode = (name, file, limit = '50 kB') =>
  nodeEntry(name, `packages/react/dist/${file}.mjs`, limit, {
    ignore: reactPeerIgnore,
  });

const next = (name, file, limit = '55 kB') =>
  entry(name, `packages/next/dist/${file}.js`, limit, {
    ignore: nextPeerIgnore,
  });

const nextNode = (name, file, limit = '55 kB') =>
  nodeEntry(name, `packages/next/dist/${file}.js`, limit, {
    ignore: nextPeerIgnore,
  });

const node = (name, file, limit = '30 kB') =>
  nodeEntry(name, `packages/node/dist/${file}.mjs`, limit);

const tanstack = (name, file) =>
  entry(name, `packages/tanstack-start/dist/${file}.mjs`, '52 kB', {
    ignore: tanstackPeerIgnore,
  });

const tanstackNode = (name, file) =>
  nodeEntry(name, `packages/tanstack-start/dist/${file}.mjs`, '52 kB', {
    ignore: tanstackPeerIgnore,
  });

const reactNative = (name, file, limit = '50 kB') =>
  entry(name, `packages/react-native/dist/module/${file}.js`, limit, {
    ignore: reactNativePeerIgnore,
  });

const reactNativeNode = (name, file) =>
  nodeEntry(name, `packages/react-native/dist/module/${file}.js`, '50 kB', {
    ignore: reactNativePeerIgnore,
  });

module.exports = [
  core('generaltranslation', 'index'),
  core('generaltranslation/api', 'api'),
  core('generaltranslation/runtime', 'runtime'),
  core('generaltranslation/id', 'id'),
  core('generaltranslation/internal', 'internal'),
  entry(
    'generaltranslation/diagnostics',
    'packages/core/dist/diagnostics.mjs',
    '1 kB'
  ),
  // Node-only: loads valibot to validate gt.config.json.
  nodeEntry(
    'generaltranslation/config-schema',
    'packages/core/dist/config-schema.mjs',
    '10 kB'
  ),

  format('@generaltranslation/format', 'index'),
  format('@generaltranslation/format/internal', 'internal'),

  i18n('gt-i18n', 'index'),
  i18n('gt-i18n/internal', 'internal'),
  i18n('gt-i18n/internal/cookies', 'internal-cookies'),
  i18n('gt-i18n/internal/string', 'internal-string'),

  reactCore('@generaltranslation/react-core/pure', 'pure'),
  reactCore('@generaltranslation/react-core/hooks', 'hooks'),
  reactCore('@generaltranslation/react-core/components', 'components'),
  reactCore('@generaltranslation/react-core/components-rsc', 'components-rsc'),

  react('gt-react (client)', 'index.client', '55 kB'),
  reactNode('gt-react (rsc)', 'index.rsc'),
  reactNode('gt-react (server)', 'index.server', '55 kB'),
  react('gt-react/compat (client)', 'compat.client'),
  reactNode('gt-react/compat (rsc)', 'compat.rsc'),
  reactNode('gt-react/compat (server)', 'compat.server'),
  react('gt-react/macros', 'macros'),

  // Locale matching is loaded only when initializeGTSPA() runs. Track the
  // always-loaded runtime and complete SPA payload independently.
  vue('gt-vue', 'index', '15 kB', {
    ignore: ['vue', '@generaltranslation/format'],
  }),
  vue('gt-vue (SPA)', 'index', '22 kB'),

  next('gt-next (client)', 'index.client', '75 kB'),
  nextNode('gt-next (rsc)', 'index.rsc', '85 kB'),
  nextNode('gt-next (server)', 'index.server', '85 kB'),
  nextNode('gt-next/config', 'config', '300 kB'),
  nextNode('gt-next/server', 'server', '85 kB'),
  next('gt-next/compat (client)', 'compat.client', '75 kB'),
  nextNode('gt-next/compat (rsc)', 'compat.rsc', '85 kB'),
  nextNode('gt-next/compat (server)', 'compat.server', '85 kB'),
  nextNode('gt-next/compat/server', 'compat/server', '85 kB'),
  nextNode('gt-next/middleware', 'middleware'),
  next('gt-next/link', 'link', '65 kB'),
  nextNode('gt-next/internal/_dictionary', 'internal/_dictionary'),
  nextNode(
    'gt-next/internal/_load-translations',
    'internal/_load-translations'
  ),
  nextNode('gt-next/internal/_load-dictionary', 'internal/_load-dictionary'),
  nextNode('gt-next/internal/_getLocale', 'internal/_getLocale', '60 kB'),
  nextNode('gt-next/internal/_getRegion', 'internal/_getRegion'),

  node('gt-node', 'index', '40 kB'),
  node('gt-node/compat', 'compat'),
  node('gt-node/internal', 'internal'),

  tanstack('gt-tanstack-start (client)', 'index.client'),
  tanstackNode('gt-tanstack-start (server)', 'index.server'),
  tanstack('gt-tanstack-start/compat (client)', 'compat.client'),
  tanstackNode('gt-tanstack-start/compat (server)', 'compat.server'),

  reactNative('gt-react-native', 'index', '52 kB'),
  reactNative('gt-react-native/compat', 'compat'),
  reactNativeNode('gt-react-native/plugin', 'plugin'),
  reactNative('gt-react-native/internal', 'internal'),
];
