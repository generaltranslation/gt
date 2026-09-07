import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveTurbopackRoot } from '../../../src/config-dir/auto-jsx/resolveJsxImportSource';
import { resolveAutoJsxRuntimePackageRoots } from '../../../src/config-dir/auto-jsx/runtimePackageRoots';

const repository = fileURLToPath(new URL('../../../../../', import.meta.url));
const artifacts = mkdtempSync(path.join(tmpdir(), 'gt-runtime-root-versions-'));
const hosts = [
  { name: 'Next 15', project: 'packages/next', major: 15 },
  {
    name: 'Next 16',
    project: 'tests/apps/next-app-router-locale-routing',
    major: 16,
  },
] as const;
const layouts = [
  { name: 'no-config', markers: [] },
  { name: 'local-lock', markers: ['site/pnpm-lock.yaml'] },
  {
    name: 'nested-lockfiles',
    markers: ['package-lock.json', 'site/pnpm-lock.yaml'],
  },
  {
    name: 'workspace-with-local-lock',
    markers: ['pnpm-workspace.yaml', 'site/pnpm-lock.yaml'],
  },
  {
    name: 'workspace-with-outer-lock',
    markers: [
      'package-lock.json',
      'nested/pnpm-workspace.yaml',
      'nested/site/pnpm-lock.yaml',
    ],
  },
] as const;

type HostRootFinder = {
  findRootDir?: (directory: string) => string | undefined;
  findRootDirAndLockFiles?: (directory: string) => { rootDir: string };
};

describe.each(hosts)('$name project root metadata', (host) => {
  it.each(layouts)(
    'uses the installed host root for $name',
    ({ name, markers }) => {
      const base = path.join(artifacts, String(host.major), name);
      const project = path.join(
        base,
        name === 'workspace-with-outer-lock' ? 'nested/site' : 'site'
      );
      const modules = path.join(project, 'node_modules');
      mkdirSync(modules, { recursive: true });
      for (const marker of markers) writeFileSync(path.join(base, marker), '');

      const sourceRequire = createRequire(
        path.join(repository, host.project, 'package.json')
      );
      const installedManifest = sourceRequire.resolve('next/package.json');
      expect(sourceRequire('next/package.json').version).toMatch(
        new RegExp(`^${host.major}\\.`)
      );
      symlinkSync(path.dirname(installedManifest), path.join(modules, 'next'));

      const projectRequire = createRequire(path.join(project, 'package.json'));
      const finder = projectRequire(
        'next/dist/lib/find-root'
      ) as HostRootFinder;
      const measured =
        finder.findRootDirAndLockFiles?.(project).rootDir ??
        finder.findRootDir?.(project) ??
        project;
      const expected =
        host.major === 15 || name === 'no-config' || name === 'local-lock'
          ? project
          : base;
      expect(measured).toBe(expected);
      expect(resolveTurbopackRoot({}, project)).toBe(measured);

      // Root selection controls the SWC metadata spelling of the same verified
      // package; a different inferred root must not produce an unrelated alias.
      const runtime = path.join(modules, 'gt-next');
      mkdirSync(path.join(runtime, 'dist'), { recursive: true });
      writeFileSync(
        path.join(runtime, 'package.json'),
        JSON.stringify({ name: 'gt-next', main: './dist/index.js' })
      );
      writeFileSync(
        path.join(runtime, 'dist/index.js'),
        'exports.runtime = true;'
      );
      const roots = resolveAutoJsxRuntimePackageRoots(
        path.join(runtime, 'dist'),
        project,
        resolveTurbopackRoot({}, project)
      );
      const relative = path.relative(expected, runtime).replace(/\\/g, '/');
      expect(roots).toContain(`[project]/${relative}`);
      expect(roots).toContain(relative);
      expect(roots).not.toContain('[project]');
      expect(roots).not.toContain('[project]/node_modules/user-cards');
    }
  );
});
