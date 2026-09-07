import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAutoJsxRuntimePackageRoots } from '../runtimePackageRoots';
import { resolveTurbopackRoot } from '../resolveJsxImportSource';

function temporaryRoot(): string {
  // Retain isolated fixtures for inspection of package-layout regressions.
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gt-runtime-scope-'));
}

function packageAt(directory: string, name: string) {
  fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      ...(name === '@generaltranslation/react-core'
        ? { exports: { './pure': './dist/index.js' } }
        : { main: './dist/index.js' }),
    })
  );
  fs.writeFileSync(
    path.join(directory, 'dist/index.js'),
    'exports.marker = true;'
  );
}

describe('automatic JSX runtime package identities', () => {
  it('resolves a published package and its nested runtime dependencies', () => {
    const root = temporaryRoot();
    const next = path.join(root, 'node_modules/gt-next');
    const react = path.join(next, 'node_modules/gt-react');
    const core = path.join(
      react,
      'node_modules/@generaltranslation/react-core'
    );
    packageAt(next, 'gt-next');
    packageAt(react, 'gt-react');
    packageAt(core, '@generaltranslation/react-core');
    packageAt(path.join(next, 'node_modules/user-cards'), 'user-cards');
    const roots = resolveAutoJsxRuntimePackageRoots(path.join(next, 'dist'));
    const physical = [next, react, core].map((directory) =>
      fs.realpathSync(directory)
    );
    expect(roots).toEqual(expect.arrayContaining([next, ...physical]));
    expect(
      roots.every((directory) => physical.includes(fs.realpathSync(directory)))
    ).toBe(true);
    expect(roots.some((directory) => directory.includes('user-cards'))).toBe(
      false
    );
  });

  it('keeps both logical and physical paths for workspace links', () => {
    const root = temporaryRoot();
    const next = path.join(root, 'workspace/next');
    const react = path.join(root, 'workspace/react');
    packageAt(next, 'gt-next');
    packageAt(react, 'gt-react');
    const nextLink = path.join(root, 'app/node_modules/gt-next');
    const reactLink = path.join(next, 'node_modules/gt-react');
    fs.mkdirSync(path.dirname(nextLink), { recursive: true });
    fs.mkdirSync(path.dirname(reactLink), { recursive: true });
    fs.symlinkSync(next, nextLink, 'junction');
    fs.symlinkSync(react, reactLink, 'junction');
    const roots = resolveAutoJsxRuntimePackageRoots(
      path.join(nextLink, 'dist')
    );
    expect(roots).toEqual(
      expect.arrayContaining([
        nextLink,
        fs.realpathSync(next),
        path.join(nextLink, 'node_modules/gt-react'),
        fs.realpathSync(react),
      ])
    );
  });

  it('includes app-direct runtime versions without excluding the app or user packages', () => {
    const root = temporaryRoot();
    const next = path.join(root, 'node_modules/gt-next');
    const nestedReact = path.join(next, 'node_modules/gt-react');
    const appReact = path.join(root, 'node_modules/gt-react');
    const appCore = path.join(
      root,
      'node_modules/@generaltranslation/react-core'
    );
    const userPackage = path.join(root, 'node_modules/user-cards');
    packageAt(next, 'gt-next');
    packageAt(nestedReact, 'gt-react');
    packageAt(appReact, 'gt-react');
    packageAt(appCore, '@generaltranslation/react-core');
    packageAt(userPackage, 'user-cards');
    const roots = resolveAutoJsxRuntimePackageRoots(
      path.join(next, 'dist'),
      root
    );
    expect(roots).toEqual(
      expect.arrayContaining(
        [next, nestedReact, appReact, appCore].map((directory) =>
          fs.realpathSync(directory)
        )
      )
    );
    expect(roots).not.toContain(root);
    expect(roots).not.toContain(fs.realpathSync(root));
    expect(roots).not.toContain(userPackage);
  });

  it.each(['explicit', 'workspace'] as const)(
    'matches Turbopack project filenames under an %s root',
    (mode) => {
      const workspace = temporaryRoot();
      const project = path.join(workspace, 'apps/site');
      const next = path.join(project, 'node_modules/gt-next');
      const core = path.join(
        next,
        'node_modules/@generaltranslation/react-core'
      );
      packageAt(next, 'gt-next');
      packageAt(core, '@generaltranslation/react-core');
      fs.writeFileSync(
        path.join(workspace, 'pnpm-workspace.yaml'),
        'packages: []'
      );
      fs.writeFileSync(
        path.join(project, 'pnpm-lock.yaml'),
        'lockfileVersion: 9'
      );
      const root = resolveTurbopackRoot(
        mode === 'explicit' ? { turbopack: { root: project } } : {},
        project
      );
      expect(root).toBe(mode === 'explicit' ? project : workspace);
      const roots = resolveAutoJsxRuntimePackageRoots(
        path.join(next, 'dist'),
        project,
        root
      );
      const prefix = mode === 'explicit' ? '[project]' : '[project]/apps/site';
      expect(roots).toEqual(
        expect.arrayContaining([
          `${prefix}/node_modules/gt-next`,
          `${prefix}/node_modules/gt-next/node_modules/@generaltranslation/react-core`,
          `${mode === 'explicit' ? '' : 'apps/site/'}node_modules/gt-next`,
          `${mode === 'explicit' ? '' : 'apps/site/'}node_modules/gt-next/node_modules/@generaltranslation/react-core`,
        ])
      );
      expect(roots).not.toContain(prefix);
      expect(roots).not.toContain(`${prefix}/node_modules/user-cards`);
    }
  );

  it('does not trust a runtime-looking directory with another package identity', () => {
    const root = temporaryRoot();
    const next = path.join(root, 'node_modules/gt-next');
    packageAt(next, 'user-gt-next');
    expect(resolveAutoJsxRuntimePackageRoots(path.join(next, 'dist'))).toEqual(
      []
    );
    packageAt(next, 'gt-next');
    packageAt(path.join(next, 'node_modules/gt-react'), 'user-react');
    const roots = resolveAutoJsxRuntimePackageRoots(path.join(next, 'dist'));
    expect(roots).not.toContain(path.join(next, 'node_modules/gt-react'));
  });

  it('preserves literal path characters and finds an enclosing package manifest', () => {
    const root = temporaryRoot();
    const next = path.join(root, '#build?copy/node_modules/gt-next');
    packageAt(next, 'gt-next');
    fs.mkdirSync(path.join(next, 'dist/config-dir'), { recursive: true });
    fs.writeFileSync(path.join(next, 'dist/package.json'), '{"type":"module"}');
    expect(
      resolveAutoJsxRuntimePackageRoots(path.join(next, 'dist/config-dir'))
    ).toEqual(expect.arrayContaining([next, fs.realpathSync(next)]));
  });
});
