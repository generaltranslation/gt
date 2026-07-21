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
  core('generaltranslation/runtime', 'runtime'),
  core('generaltranslation/id', 'id'),
  core('generaltranslation/internal', 'internal'),
  core('generaltranslation/types', 'types'),
  core('generaltranslation/errors', 'errors'),

  format('@generaltranslation/format', 'index'),
  format('@generaltranslation/format/types', 'types'),
  format('@generaltranslation/format/internal', 'internal'),

  i18n('gt-i18n', 'index'),
  i18n('gt-i18n/types', 'types'),
  i18n('gt-i18n/internal', 'internal'),
  i18n('gt-i18n/internal/types', 'internal-types'),

  reactCore('@generaltranslation/react-core/pure', 'pure'),
  reactCore('@generaltranslation/react-core/hooks', 'hooks'),
  reactCore('@generaltranslation/react-core/components', 'components'),
  reactCore('@generaltranslation/react-core/components-rsc', 'components-rsc'),

  react('gt-react (client)', 'index.client', '55 kB'),
  reactNode('gt-react (rsc)', 'index.rsc'),
  reactNode('gt-react (server)', 'index.server', '55 kB'),
  react('gt-react/macros', 'macros'),

  next('gt-next (client)', 'index.client', '75 kB'),
  nextNode('gt-next (rsc)', 'index.rsc', '85 kB'),
  nextNode('gt-next (server)', 'index.server', '85 kB'),
  nextNode('gt-next/config', 'config', '300 kB'),
  nextNode('gt-next/server', 'server', '85 kB'),
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
  node('gt-node/types', 'types'),
  node('gt-node/internal', 'internal'),

  tanstack('gt-tanstack-start (client)', 'index.client'),
  tanstackNode('gt-tanstack-start (server)', 'index.server'),
  tanstackNode('gt-tanstack-start/server', 'server'),

  reactNative('gt-react-native', 'index', '52 kB'),
  reactNativeNode('gt-react-native/plugin', 'plugin'),
  reactNative('gt-react-native/internal', 'internal'),
];
