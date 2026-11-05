import { describe, expect, it } from 'vitest';
import {
  bundleDetail,
  diffBundles,
  summarizeBundle,
  summarizeExample,
} from '../server/report.ts';
import type {
  BundleReport,
  ExampleState,
  ModuleSize,
} from '../shared/types.ts';

const module = (
  pkg: string,
  path: string,
  bytes: number,
  gt = false
): ModuleSize => ({
  id: `${pkg}/${path}`,
  pkg,
  path,
  gt,
  bytes,
});

const report = (modules: ModuleSize[]): BundleReport => {
  const total = modules.reduce((sum, m) => sum + m.bytes, 0);
  return {
    kind: 'client',
    files: [{ path: 'dist/a.js', bytes: total, gzip: Math.round(total / 3) }],
    totalBytes: total,
    gzipBytes: Math.round(total / 3),
    modules,
  };
};

const before = report([
  module('gt-react', 'dist/index.mjs', 300, true),
  module('gt-i18n', 'dist/a.mjs', 100, true),
  module('react-dom', 'cjs/x.js', 600),
]);
const after = report([
  module('gt-react', 'dist/index.mjs', 250, true),
  module('gt-i18n', 'dist/a.mjs', 100, true),
  module('gt-i18n', 'dist/new.mjs', 20, true),
  module('react-dom', 'cjs/x.js', 600),
]);

describe('summarizeBundle', () => {
  it('reports GT bytes, share, packages, and change', () => {
    const summary = summarizeBundle(after, before);
    expect(summary.totalBytes).toBe(970);
    expect(summary.gtBytes).toBe(370);
    expect(summary.gtPercent).toBe(38.1);
    expect(summary.change).toEqual({ totalBytes: -30, gtBytes: -30 });
    expect(summary.gtPackages).toEqual([
      { name: 'gt-react', bytes: 250 },
      { name: 'gt-i18n', bytes: 120 },
    ]);
    expect(summary.topPackages[0]).toEqual({
      name: 'react-dom',
      bytes: 600,
      gt: false,
    });
  });

  it('has no change for the first build', () => {
    expect(summarizeBundle(after, undefined).change).toBeNull();
  });
});

describe('summarizeExample', () => {
  it('lists only bundles that were built and includes build errors', () => {
    const state: ExampleState = {
      example: 'vite-react',
      title: 'Vite React',
      bundles: ['client'],
      settings: { minify: true, treeShake: true },
      status: {
        state: 'error',
        message: 'The build exited with code 1.',
        log: 'boom',
      },
      current: {
        example: 'vite-react',
        settings: { minify: true, treeShake: true },
        builtAt: '2026-10-02T00:00:00.000Z',
        buildMs: 900,
        bundles: { client: after },
      },
      previous: null,
    };
    const summary = summarizeExample(state, true);
    expect(Object.keys(summary.bundles)).toEqual(['client']);
    expect(summary).toMatchObject({
      status: 'error',
      error: 'The build exited with code 1.',
      stale: true,
    });
  });
});

describe('bundleDetail', () => {
  it('lists packages by default', () => {
    const detail = bundleDetail(after, {});
    expect(detail).toMatchObject({ gtBytes: 370 });
    expect('packages' in detail && detail.packages?.map((p) => p.name)).toEqual(
      ['react-dom', 'gt-react', 'gt-i18n']
    );
  });

  it('lists one package’s files and searches paths', () => {
    expect(bundleDetail(after, { pkg: 'gt-i18n' })).toMatchObject({
      matchedBytes: 120,
      matchedFiles: 2,
    });
    expect(bundleDetail(after, { query: 'NEW' })).toMatchObject({
      matchedFiles: 1,
    });
    expect(bundleDetail(after, { pkg: 'gt-i18n', limit: 1 })).toMatchObject({
      files: [{ package: 'gt-i18n', path: 'dist/a.mjs', bytes: 100 }],
    });
  });
});

describe('diffBundles', () => {
  it('lists changed, added, and removed files by size of change', () => {
    const shrunk = report([module('gt-react', 'dist/index.mjs', 300, true)]);
    const diff = diffBundles(after, before);
    expect(diff.totalChange).toBe(-30);
    expect(diff.gtChange).toBe(-30);
    expect(diff.files.map((f) => [f.path, f.change])).toEqual([
      ['dist/index.mjs', -50],
      ['dist/new.mjs', 20],
    ]);
    const removed = diffBundles(shrunk, before);
    expect(removed.files.find((f) => f.package === 'react-dom')).toMatchObject({
      before: 600,
      after: 0,
      change: -600,
    });
  });
});
