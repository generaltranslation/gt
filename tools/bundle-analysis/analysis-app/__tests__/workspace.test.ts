import { describe, expect, it } from 'vitest';
import {
  createClassifier,
  readWorkspacePackages,
} from '../server/workspace.ts';

const classify = createClassifier(
  [
    { name: 'gt-react', dir: '/repo/packages/react' },
    {
      name: '@generaltranslation/react-core',
      dir: '/repo/packages/react-core',
    },
  ],
  '/repo/tools/bundle-analysis/examples/vite-react'
);

describe('createClassifier', () => {
  it('maps workspace package paths to their package names', () => {
    expect(classify('/repo/packages/react-core/dist/index.mjs')).toEqual({
      pkg: '@generaltranslation/react-core',
      path: 'dist/index.mjs',
      gt: true,
    });
    expect(classify('/repo/packages/react/dist/a.mjs').pkg).toBe('gt-react');
  });

  it('uses the innermost node_modules package, including scoped names', () => {
    expect(
      classify(
        '/store/links/x/node_modules/@tanstack/router-core/dist/esm/a.js'
      )
    ).toEqual({
      pkg: '@tanstack/router-core',
      path: 'dist/esm/a.js',
      gt: false,
    });
    expect(
      classify('/a/node_modules/b/node_modules/react-dom/cjs/x.js').pkg
    ).toBe('react-dom');
  });

  it('marks registry installs of GT packages as GT', () => {
    expect(classify('/app/node_modules/gt-next/dist/index.js').gt).toBe(true);
    expect(
      classify('/app/node_modules/@generaltranslation/format/x.js').gt
    ).toBe(true);
    expect(classify('/app/node_modules/gtag/x.js').gt).toBe(false);
  });

  it('labels example sources, bundler virtual modules, and unmapped bytes', () => {
    expect(
      classify('/repo/tools/bundle-analysis/examples/vite-react/src/App.tsx')
    ).toEqual({
      pkg: '(app)',
      path: 'src/App.tsx',
      gt: false,
    });
    expect(
      classify(
        '/repo/tools/bundle-analysis/examples/vite-react/.next/static/chunks/[turbopack]/runtime.ts'
      )
    ).toEqual({ pkg: '(bundler)', path: '[turbopack]/runtime.ts', gt: false });
    expect(classify('\0rolldown/runtime.js').pkg).toBe('(bundler)');
    expect(classify(null).pkg).toBe('(unmapped)');
  });
});

describe('readWorkspacePackages', () => {
  it('finds the GT packages in this repo', () => {
    const names = readWorkspacePackages().map((pkg) => pkg.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'gt-next',
        'gt-react',
        'gt-i18n',
        'generaltranslation',
      ])
    );
  });
});
