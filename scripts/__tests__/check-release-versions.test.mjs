import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

const script = path.resolve(
  import.meta.dirname,
  '../check-release-versions.mjs'
);
const notFound =
  'globalThis.fetch = async () => new Response(null, { status: 404 });';

test('stops a release of a package missing from npm', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'check-release-versions-'));
  onTestFinished(() => rm(root, { recursive: true }));
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
      { cwd: root }
    );
  const manifest = (version) =>
    writeFile(
      path.join(root, 'packages/pkg/package.json'),
      JSON.stringify({ name: 'pkg', version })
    );
  await mkdir(path.join(root, 'packages/pkg'), { recursive: true });
  git('init', '-q');
  await manifest('0.0.0');
  git('add', '.');
  git('commit', '-qm', 'base');
  await manifest('0.1.0');
  git('commit', '-qam', 'bump');

  const { status, stderr } = spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(notFound)}`,
      script,
      'HEAD^',
      'HEAD',
    ],
    { cwd: root, encoding: 'utf8' }
  );

  expect(status).toBe(1);
  expect(stderr).toContain('pkg is not on npm yet');
});
