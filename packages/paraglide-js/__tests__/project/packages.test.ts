import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { projectPackages } from '../../src/compiler/project/packages.js';

/** This package: its devDependencies are the language tools, as an app has them. */
const ROOT = path.resolve(import.meta.dirname, '../..');

function installedVersion(name: string): string {
  const manifest = path.join(ROOT, 'node_modules', name, 'package.json');
  return (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version: string })
    .version;
}

test('the versions of the package `load` imports, and of its dependencies', async () => {
  const packages = projectPackages(ROOT);
  const versions = await packages.versions('@vue/language-core');

  expect(versions[0]).toBe(
    `@vue/language-core@${installedVersion('@vue/language-core')}`
  );
  // Its own dependencies, e.g. the Vue compiler, change what it generates too.
  expect(versions).toContainEqual(
    expect.stringMatching(/^@vue\/compiler-dom@\d/)
  );
  expect(await packages.versions('not-an-installed-package')).toEqual([
    'not-an-installed-package@none',
  ]);
});
