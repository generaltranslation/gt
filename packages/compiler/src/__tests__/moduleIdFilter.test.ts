import { describe, expect, it } from 'vitest';
import gtUnplugin from '../index';

function getTransformInclude(): (id: string) => boolean {
  const plugin = gtUnplugin.raw({ logLevel: 'silent' }, { framework: 'vite' });
  const transformInclude = plugin.transformInclude;
  if (typeof transformInclude !== 'function') {
    throw new Error('Expected transformInclude hook to be a function');
  }
  return (id) => Boolean(transformInclude(id));
}

describe('module id filter (transformInclude)', () => {
  const transformInclude = getTransformInclude();

  it.each([
    '/app/src/App.tsx',
    '/app/src/App.jsx',
    '/app/src/util.ts',
    '/app/src/util.js',
  ])('accepts plain JS/TS source %s', (id) => {
    expect(transformInclude(id)).toBe(true);
  });

  it.each([
    '/app/src/routes/index.tsx?tsr-split=component',
    '/app/src/routes/about.tsx?tsr-split=component&v=123',
    '/app/src/App.tsx?v=abc123',
  ])('accepts JS/TS source with a non-asset query string %s', (id) => {
    expect(transformInclude(id)).toBe(true);
  });

  it.each([
    '/app/src/strings.ts?raw',
    '/app/src/logo.js?url',
    '/app/src/compute.ts?worker',
    '/app/src/compute.ts?worker&url',
    '/app/src/compute.ts?sharedworker',
    '/app/src/inline.js?inline',
    '/app/src/App.tsx?v=1&raw',
    '/app/src/data.js?import',
  ])('skips asset-style imports of JS/TS files %s', (id) => {
    expect(transformInclude(id)).toBe(false);
  });

  it.each([
    '/app/node_modules/some-lib/dist/index.js',
    '/app/node_modules/.pnpm/gt-react@1.0.0/node_modules/gt-react/dist/index.js',
    '/app/node_modules/@tanstack/react-router/dist/esm/index.js?v=abc123',
    'C:\\app\\node_modules\\some-lib\\dist\\index.js',
  ])('skips dependencies in node_modules %s', (id) => {
    expect(transformInclude(id)).toBe(false);
  });

  it.each([
    '\0virtual:some-module.js',
    '\0/app/src/App.tsx?commonjs-proxy',
    '/app/src/types.d.ts',
  ])('skips virtual modules and declaration files %s', (id) => {
    expect(transformInclude(id)).toBe(false);
  });

  it('skips non-JS/TS files', () => {
    expect(transformInclude('/app/src/styles.css')).toBe(false);
    expect(transformInclude('/app/src/data.json')).toBe(false);
    expect(transformInclude('/app/src/Page.vue?vue&type=script&lang.ts')).toBe(
      false
    );
  });
});
