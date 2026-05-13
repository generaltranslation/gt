import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveImportPath } from '../resolveImportPath.js';
import type { ParsingConfigOptions } from '../../../../types/parsing.js';

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

let testDir: string | undefined;

function createTestProject(paths: Record<string, string[]>) {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-resolve-import-'));
  fs.writeFileSync(
    path.join(testDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths,
      },
    })
  );

  const currentDir = path.join(testDir, 'screens', 'account');
  fs.mkdirSync(currentDir, { recursive: true });
  const currentFile = path.join(currentDir, 'AccountOverviewPage.tsx');
  fs.writeFileSync(currentFile, "import { menuItems } from '@/util';");

  return { currentFile, root: testDir };
}

function resolveImport(currentFile: string, importPath: string) {
  return resolveImportPath(currentFile, importPath, parsingOptions, new Map());
}

afterEach(() => {
  if (testDir) {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = undefined;
  }
});

describe('resolveImportPath', () => {
  it('resolves tsconfig path aliases to directory index files', () => {
    const { currentFile, root } = createTestProject({ '@/*': ['./*'] });
    const utilDir = path.join(root, 'util');
    fs.mkdirSync(utilDir, { recursive: true });

    const indexFile = path.join(utilDir, 'index.ts');
    fs.writeFileSync(indexFile, "export * from './accountMenuItems';");
    fs.writeFileSync(
      path.join(utilDir, 'accountMenuItems.tsx'),
      "export const menuItems = ['View account details'];"
    );

    const resolved = resolveImport(currentFile, '@/util');

    expect(resolved).toBe(indexFile);
  });

  it('resolves tsconfig path aliases to files without explicit import extensions', () => {
    const { currentFile, root } = createTestProject({ '@/*': ['./*'] });
    const utilDir = path.join(root, 'util');
    fs.mkdirSync(utilDir, { recursive: true });

    const helperFile = path.join(utilDir, 'accountMenuItems.tsx');
    fs.writeFileSync(
      helperFile,
      "export const menuItems = ['View account details'];"
    );

    const resolved = resolveImport(currentFile, '@/util/accountMenuItems');

    expect(resolved).toBe(helperFile);
  });

  it('resolves tsconfig path aliases to files with explicit import extensions', () => {
    const { currentFile, root } = createTestProject({ '@/*': ['./*'] });
    const utilDir = path.join(root, 'util');
    fs.mkdirSync(utilDir, { recursive: true });

    const helperFile = path.join(utilDir, 'accountMenuItems.tsx');
    fs.writeFileSync(
      helperFile,
      "export const menuItems = ['View account details'];"
    );

    const resolved = resolveImport(currentFile, '@/util/accountMenuItems.tsx');

    expect(resolved).toBe(helperFile);
  });

  it('resolves aliases that match after appending an import extension', () => {
    const { currentFile, root } = createTestProject({
      '@account-menu.ts': ['./util/accountMenuItems.ts'],
    });
    const utilDir = path.join(root, 'util');
    fs.mkdirSync(utilDir, { recursive: true });

    const helperFile = path.join(utilDir, 'accountMenuItems.ts');
    fs.writeFileSync(
      helperFile,
      "export const menuItems = ['View account details'];"
    );

    const resolved = resolveImport(currentFile, '@account-menu');

    expect(resolved).toBe(helperFile);
  });

  it('returns null for aliased directories without index files', () => {
    const { currentFile, root } = createTestProject({ '@/*': ['./*'] });
    fs.mkdirSync(path.join(root, 'util'), { recursive: true });

    const resolved = resolveImport(currentFile, '@/util');

    expect(resolved).toBeNull();
  });

  it('returns null when no resolver can match an import path', () => {
    const { currentFile } = createTestProject({ '@/*': ['./*'] });

    const resolved = resolveImport(currentFile, '@/missing');

    expect(resolved).toBeNull();
  });
});
