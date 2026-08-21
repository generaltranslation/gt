import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractFromVueSource } from '../../index.js';
import { createProjectModuleResolver } from '../project/moduleResolver.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('malformed nearest package boundaries', () => {
  it('does not resolve a parent package past a malformed nearest install', () => {
    const fixture = createNestedPackageFixture();
    const resolveModule = createProjectModuleResolver();

    expect(resolveModule('wrapper', fixture.importer)).toBeUndefined();
  });

  it('does not inherit gt-vue provenance from the shadowed parent package', async () => {
    const fixture = createNestedPackageFixture();
    const source = `
      import { T } from 'wrapper';
      export const App = () => <T>Wrong parent message</T>;
    `;
    fs.writeFileSync(fixture.importer, source);

    const output = await extractFromVueSource(source, fixture.importer, {
      projectRoot: fixture.root,
      requireGTProvenance: true,
      resolveModule: createProjectModuleResolver(),
    });

    expect(output.results).toEqual([]);
    expect(output.errors).toEqual([]);
  });
});

function createNestedPackageFixture(): {
  importer: string;
  root: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-malformed-'));
  temporaryDirectories.push(root);
  const localWrapper = path.join(root, 'packages/wrapper');
  const parentLink = path.join(root, 'node_modules/wrapper');
  const nearestWrapper = path.join(root, 'apps/client/node_modules/wrapper');
  const importer = path.join(root, 'apps/client/src/App.tsx');
  for (const directory of [
    localWrapper,
    path.dirname(parentLink),
    nearestWrapper,
    path.dirname(importer),
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: '@fixture/root' })
  );
  fs.writeFileSync(
    path.join(localWrapper, 'package.json'),
    JSON.stringify({
      name: 'wrapper',
      version: '1.0.0',
      exports: './index.ts',
    })
  );
  fs.writeFileSync(
    path.join(localWrapper, 'index.ts'),
    "export { T } from 'gt-vue';\n"
  );
  fs.symlinkSync(localWrapper, parentLink, 'dir');
  fs.writeFileSync(path.join(nearestWrapper, 'package.json'), '{malformed');
  fs.writeFileSync(
    path.join(nearestWrapper, 'index.js'),
    'export const T = String;\n'
  );
  fs.writeFileSync(importer, 'export {};\n');
  return { importer, root };
}
