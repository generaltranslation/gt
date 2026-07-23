import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectPackageManagerWithRoot } from '../packageManager.js';

let root: string;

function write(rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-pm-ws-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('detectPackageManagerWithRoot', () => {
  it('finds the npm workspace root above a member without its own lockfile', () => {
    write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    write('package-lock.json', '{}');
    write('packages/dashboard/package.json', JSON.stringify({ name: 'dash' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/dashboard')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('npm');
    expect(fs.realpathSync(result!.root)).toBe(fs.realpathSync(root));
  });

  it('finds a pnpm workspace root via pnpm-workspace.yaml', () => {
    write('package.json', JSON.stringify({ name: 'mono' }));
    write('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
    write('pnpm-lock.yaml', 'lockfileVersion: 9');
    write('apps/web/package.json', JSON.stringify({ name: 'web' }));

    const result = detectPackageManagerWithRoot(path.join(root, 'apps/web'));
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('pnpm');
    expect(fs.realpathSync(result!.root)).toBe(fs.realpathSync(root));
  });

  it('prefers the directory itself when it has its own lockfile', () => {
    write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    write('package-lock.json', '{}');
    write('packages/standalone/package.json', JSON.stringify({ name: 's' }));
    write('packages/standalone/pnpm-lock.yaml', 'lockfileVersion: 9');

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/standalone')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('pnpm');
    expect(fs.realpathSync(result!.root)).toBe(
      fs.realpathSync(path.join(root, 'packages/standalone'))
    );
  });

  it('ignores an ancestor lockfile without workspace evidence', () => {
    // A lockfile-bearing ancestor that is not a workspace root must not be
    // treated as one: installing there would not wire up the member.
    write('package.json', JSON.stringify({ name: 'not-a-workspace' }));
    write('package-lock.json', '{}');
    write('nested/app/package.json', JSON.stringify({ name: 'app' }));

    const result = detectPackageManagerWithRoot(path.join(root, 'nested/app'));
    expect(result).toBeNull();
  });

  it('rejects a workspace root whose patterns do not cover the member', () => {
    // Targeting an uncovered directory would make `npm install --workspace`
    // fail ("No workspaces found"), so the root must not claim it.
    write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    write('package-lock.json', '{}');
    write('apps/web/package.json', JSON.stringify({ name: 'web' }));

    const result = detectPackageManagerWithRoot(path.join(root, 'apps/web'));
    expect(result).toBeNull();
  });

  it('covers a deep member through a ** pattern', () => {
    write('package.json', JSON.stringify({ workspaces: ['packages/**'] }));
    write('package-lock.json', '{}');
    write(
      'packages/apps/dashboard/package.json',
      JSON.stringify({ name: 'dash' })
    );

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/apps/dashboard')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('npm');
  });

  it('reads the workspaces object form', () => {
    write(
      'package.json',
      JSON.stringify({ workspaces: { packages: ['packages/*'] } })
    );
    write('package-lock.json', '{}');
    write('packages/dashboard/package.json', JSON.stringify({ name: 'dash' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/dashboard')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('npm');
  });

  it('parses a flow-style pnpm-workspace.yaml', () => {
    write('package.json', JSON.stringify({ name: 'mono' }));
    write('pnpm-workspace.yaml', "packages: ['apps/*', 'packages/*']\n");
    write('pnpm-lock.yaml', 'lockfileVersion: 9');
    write('apps/web/package.json', JSON.stringify({ name: 'web' }));

    const result = detectPackageManagerWithRoot(path.join(root, 'apps/web'));
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('pnpm');
  });

  it('reads only the packages key from pnpm-workspace.yaml', () => {
    // Entries under other list-valued keys (onlyBuiltDependencies, catalogs)
    // must not become member patterns.
    write('package.json', JSON.stringify({ name: 'mono' }));
    write(
      'pnpm-workspace.yaml',
      [
        'packages:',
        "  - 'apps/*'",
        'onlyBuiltDependencies:',
        '  - esbuild',
        '',
      ].join('\n')
    );
    write('pnpm-lock.yaml', 'lockfileVersion: 9');
    write('esbuild/package.json', JSON.stringify({ name: 'esbuild-dir' }));

    const result = detectPackageManagerWithRoot(path.join(root, 'esbuild'));
    expect(result).toBeNull();
  });

  it('normalizes a leading ./ in workspace patterns', () => {
    write('package.json', JSON.stringify({ workspaces: ['./packages/*'] }));
    write('package-lock.json', '{}');
    write('packages/dashboard/package.json', JSON.stringify({ name: 'dash' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/dashboard')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('npm');
  });

  it('matches zero directories through a mid-pattern globstar', () => {
    write('package.json', JSON.stringify({ workspaces: ['packages/**/lib'] }));
    write('package-lock.json', '{}');
    write('packages/lib/package.json', JSON.stringify({ name: 'lib' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/lib')
    );
    expect(result).not.toBeNull();
    expect(result!.packageManager.id).toBe('npm');
  });

  it('subtracts negated patterns', () => {
    write(
      'package.json',
      JSON.stringify({ workspaces: ['packages/*', '!packages/excluded'] })
    );
    write('package-lock.json', '{}');
    write('packages/excluded/package.json', JSON.stringify({ name: 'x' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/excluded')
    );
    expect(result).toBeNull();
  });

  it('returns null on an ambiguous ancestor', () => {
    write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
    write('package-lock.json', '{}');
    write('pnpm-lock.yaml', 'lockfileVersion: 9');
    write('packages/dashboard/package.json', JSON.stringify({ name: 'dash' }));

    const result = detectPackageManagerWithRoot(
      path.join(root, 'packages/dashboard')
    );
    expect(result).toBeNull();
  });
});
