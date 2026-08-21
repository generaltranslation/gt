import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Libraries } from '../../../types/libraries.js';
import { determineLibrary, determineLibraryForCLI } from '../index.js';

const initialCwd = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(() => {
  process.chdir(initialCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('determineLibrary Vue adapter', () => {
  it.each([
    ['Next', Libraries.GT_NEXT, Libraries.GT_NEXT],
    [
      'TanStack Start',
      Libraries.GT_TANSTACK_START,
      Libraries.GT_TANSTACK_START,
    ],
    ['React', Libraries.GT_REACT, Libraries.GT_REACT],
    ['React Native', Libraries.GT_REACT_NATIVE, Libraries.GT_REACT_NATIVE],
    ['Node', Libraries.GT_NODE, Libraries.GT_NODE],
    ['next-intl', 'next-intl', 'next-intl'],
    ['i18next', 'i18next', 'i18next'],
  ] as const)(
    'keeps the historical %s priority over a direct gt-vue dependency',
    (_name, dependency, expected) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          dependencies: { [dependency]: '*', 'gt-vue': '*' },
        }),
      });
      process.chdir(root);

      expect(determineLibrary()).toEqual({
        library: expected,
        additionalModules: [],
      });
      expect(determineLibraryForCLI()).toEqual({
        library: expected,
        additionalModules: [],
        directlyDeclaresVue: true,
      });
    }
  );

  it('keeps Python priority over a direct gt-vue dependency', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        dependencies: { 'gt-vue': '*' },
      }),
      'requirements.txt': 'gt-fastapi>=1.0.0\n',
    });
    process.chdir(root);

    expect(determineLibrary().library).toBe(Libraries.GT_FASTAPI);
  });

  it('selects gt-vue when it is the only direct supported runtime', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        devDependencies: { 'gt-vue': '*' },
      }),
    });
    process.chdir(root);

    expect(determineLibrary()).toEqual({
      library: Libraries.GT_VUE,
      additionalModules: [],
    });
    expect(determineLibraryForCLI()).toEqual({
      library: Libraries.GT_VUE,
      additionalModules: [],
      directlyDeclaresVue: true,
    });
  });

  it.each([
    [
      'optional declaration',
      {
        'package.json': JSON.stringify({
          optionalDependencies: { 'gt-vue': '*' },
        }),
      },
    ],
    [
      'peer declaration',
      {
        'package.json': JSON.stringify({
          peerDependencies: { 'gt-vue': '*' },
        }),
      },
    ],
    [
      'descendant-only declaration',
      {
        'package.json': JSON.stringify({
          private: true,
          workspaces: ['packages/*'],
        }),
        'packages/vue-app/package.json': JSON.stringify({
          name: '@fixture/vue-app',
          dependencies: { 'gt-vue': '*' },
        }),
      },
    ],
  ])('leaves %s Vue evidence inert', (_name, files) => {
    const root = createFixture(files);
    process.chdir(root);

    expect(determineLibrary()).toEqual({
      library: 'base',
      additionalModules: [],
    });
    expect(determineLibraryForCLI().directlyDeclaresVue).toBe(false);
  });
});

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cli-vue-routing-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return root;
}
