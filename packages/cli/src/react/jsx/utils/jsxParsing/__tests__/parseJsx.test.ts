import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'node:fs';
import { parseTranslationComponent } from '../parseJsx.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { hashSource } from 'generaltranslation/id';

// Mock fs and resolveImportPath
vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const mockFs = vi.mocked(fs);
const mockResolveImportPath = vi.mocked(resolveImportPath);

describe('parseTranslationComponent with cross-file resolution', () => {
  let updates: Updates;
  let errors: string[];
  let warnings: Set<string>;
  let parsingOptions: ParsingConfigOptions;

  beforeEach(() => {
    updates = [];
    errors = [];
    warnings = new Set();
    parsingOptions = {
      conditionNames: ['import', 'require'],
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve functions across multiple files with re-exports', () => {
    // Mock the file contents based on the playground scenario
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 } from "./libs/utils1";

      function getStatic() {
        return 1 ? "static" : "dynamic";
      }

      export default function Page() {
        return (
          <>
            <T>test <Static>{utils1()}</Static></T>
          </>
        );
      }
    `;

    const utils1File = `
      import { utils3 } from "./utils2";

      export function utils1() {
        if (Math.random() > 0.5) {
          return utils3();
        }
        return 1 ? "utils1-a" : "utils1-b";
      }
    `;

    const utils2File = `
      export * from "./utils3";

      // export function utils2() {
      //   return 1 ? "utils2-a" : "utils2-b";
      // }
    `;

    const utils3File = `
      import { utils1 } from "./utils1";
      export function utils3() {
        if (Math.random() > 0.5) {
          // return utils1();
          // return utils3();
        }
        return 1 ? "utils3-a" : "utils3-b";
      }
    `;

    // Set up file system mocks
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/project/libs/utils1.ts':
          return utils1File;
        case '/test/project/libs/utils2.ts':
          return utils2File;
        case '/test/project/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/project/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/project/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/project/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/project/libs/utils1.ts';
        }
        return null;
      }
    );

    // Parse the page file
    const ast = parse(pageFile, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Find the T component import and local name
    let tLocalName = '';
    const importAliases: Record<string, string> = {};

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'gt-next') {
          path.node.specifiers.forEach((spec) => {
            if (
              t.isImportSpecifier(spec) &&
              t.isIdentifier(spec.imported) &&
              spec.imported.name === 'T'
            ) {
              tLocalName = spec.local.name;
              importAliases[tLocalName] = 'T';
            }
            if (
              t.isImportSpecifier(spec) &&
              t.isIdentifier(spec.imported) &&
              spec.imported.name === 'Static'
            ) {
              importAliases[spec.local.name] = 'Static';
            }
          });
        }
      },
    });

    // Find the T component usage and test parsing
    traverse(ast, {
      Program(programPath) {
        // Find variable declarator for the T import
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkg: 'gt-next',
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/project/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Verify the parsing results - should have 4 updates based on conditional returns
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4); // Should have 4 branches: utils3-a, utils3-b, utils1-a, utils1-b

    // Calculate hashes for each update
    const hashedUpdates = updates.map((update) => {
      const context = update.metadata.context;
      const hash = hashSource({
        source: update.source,
        ...(context && { context }),
        ...(update.metadata.id && { id: update.metadata.id }),
        dataFormat: update.dataFormat,
      });
      return { hash, source: update.source };
    });

    // Expected hash-to-source mappings from your playground scenario
    const expectedData = {
      '837be41703617441': [
        'test ',
        {
          t: 'Static',
          i: 1,
          c: 'utils3-a',
        },
      ],
      '6c4330bad929001a': [
        'test ',
        {
          t: 'Static',
          i: 1,
          c: 'utils3-b',
        },
      ],
      '40d52de32ba666ce': [
        'test ',
        {
          t: 'Static',
          i: 1,
          c: 'utils1-a',
        },
      ],
      '081fa70a614caa27': [
        'test ',
        {
          t: 'Static',
          i: 1,
          c: 'utils1-b',
        },
      ],
    };

    // Hard check: Verify we have exactly the expected hashes
    const actualHashes = hashedUpdates.map((u) => u.hash).sort();
    const expectedHashes = Object.keys(expectedData).sort();
    expect(actualHashes).toEqual(expectedHashes);

    // Hard check: Verify each specific hash and data structure exists
    expect(hashedUpdates.some((u) => u.hash === '837be41703617441')).toBe(true);
    expect(hashedUpdates.some((u) => u.hash === '6c4330bad929001a')).toBe(true);
    expect(hashedUpdates.some((u) => u.hash === '40d52de32ba666ce')).toBe(true);
    expect(hashedUpdates.some((u) => u.hash === '081fa70a614caa27')).toBe(true);

    // Hard check: Verify each hash maps to the exact expected content
    const update837 = hashedUpdates.find((u) => u.hash === '837be41703617441')!;
    expect(update837.source).toEqual([
      'test ',
      {
        t: 'Static',
        i: 1,
        c: 'utils3-a',
      },
    ]);

    const update6c4 = hashedUpdates.find((u) => u.hash === '6c4330bad929001a')!;
    expect(update6c4.source).toEqual([
      'test ',
      {
        t: 'Static',
        i: 1,
        c: 'utils3-b',
      },
    ]);

    const update40d = hashedUpdates.find((u) => u.hash === '40d52de32ba666ce')!;
    expect(update40d.source).toEqual([
      'test ',
      {
        t: 'Static',
        i: 1,
        c: 'utils1-a',
      },
    ]);

    const update081 = hashedUpdates.find((u) => u.hash === '081fa70a614caa27')!;
    expect(update081.source).toEqual([
      'test ',
      {
        t: 'Static',
        i: 1,
        c: 'utils1-b',
      },
    ]);

    // Hard check: Verify hash calculation is correct for each
    expect(
      hashSource({
        source: expectedData['837be41703617441'],
        dataFormat: 'JSX',
      })
    ).toBe('837be41703617441');

    expect(
      hashSource({
        source: expectedData['6c4330bad929001a'],
        dataFormat: 'JSX',
      })
    ).toBe('6c4330bad929001a');

    expect(
      hashSource({
        source: expectedData['40d52de32ba666ce'],
        dataFormat: 'JSX',
      })
    ).toBe('40d52de32ba666ce');

    expect(
      hashSource({
        source: expectedData['081fa70a614caa27'],
        dataFormat: 'JSX',
      })
    ).toBe('081fa70a614caa27');

    // Verify that utils1 and utils3 functions were resolved
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/project/libs/utils1.ts',
      'utf8'
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/project/libs/utils2.ts',
      'utf8'
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/project/libs/utils3.ts',
      'utf8'
    );

    // Check that import paths were resolved correctly
    expect(mockResolveImportPath).toHaveBeenCalledWith(
      '/test/project/page.tsx',
      './libs/utils1',
      parsingOptions,
      expect.any(Map)
    );
    expect(mockResolveImportPath).toHaveBeenCalledWith(
      '/test/project/libs/utils1.ts',
      './utils2',
      parsingOptions,
      expect.any(Map)
    );

    // Verify all expected content variations are present
    const staticContents = hashedUpdates.map(
      (u) => (u.source[1] as { c: string }).c
    );
    expect(staticContents).toContain('utils3-a');
    expect(staticContents).toContain('utils3-b');
    expect(staticContents).toContain('utils1-a');
    expect(staticContents).toContain('utils1-b');
  });
});
