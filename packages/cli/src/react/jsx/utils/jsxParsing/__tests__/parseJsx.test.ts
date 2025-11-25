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
        case '/test/original/libs/utils1.ts':
          return utils1File;
        case '/test/original/libs/utils2.ts':
          return utils2File;
        case '/test/original/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/original/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/original/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/original/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/original/libs/utils1.ts';
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
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/original/page.tsx',
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
      '/test/original/libs/utils1.ts',
      'utf8'
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/original/libs/utils2.ts',
      'utf8'
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/original/libs/utils3.ts',
      'utf8'
    );

    // Check that import paths were resolved correctly
    expect(mockResolveImportPath).toHaveBeenCalledWith(
      '/test/original/page.tsx',
      './libs/utils1',
      parsingOptions,
      expect.any(Map)
    );
    expect(mockResolveImportPath).toHaveBeenCalledWith(
      '/test/original/libs/utils1.ts',
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

  it('should detect direct self-recursion and throw error', () => {
    // Mock the file contents with utils3 calling itself
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 } from "./libs/utils1";

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
    `;

    const utils3File = `
      import { utils1 } from "./utils1";
      export function utils3() {
        if (Math.random() > 0.5) {
          // return utils1();
          return utils3();
        }
        return 1 ? "utils3-a" : "utils3-b";
      }
    `;

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/selfrecursion/libs/utils1.ts':
          return utils1File;
        case '/test/selfrecursion/libs/utils2.ts':
          return utils2File;
        case '/test/selfrecursion/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/selfrecursion/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/selfrecursion/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/selfrecursion/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/selfrecursion/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/selfrecursion/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Should detect recursive call and add error
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((error) =>
        error.includes('Recursive function call detected: utils3')
      )
    ).toBe(true);
    expect(
      errors.some((error) =>
        error.includes(
          'A static function cannot use recursive calls to construct its result'
        )
      )
    ).toBe(true);
  });

  it('should detect cross-function recursion and throw error', () => {
    // Mock the file contents with utils3 calling utils1 (creating a cycle)
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 } from "./libs/utils1";

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
    `;

    const utils3File = `
      import { utils1 } from "./utils1";
      export function utils3() {
        if (Math.random() > 0.5) {
          return utils1();
          // return utils3();
        }
        return 1 ? "utils3-a" : "utils3-b";
      }
    `;

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/recursion2/libs/utils1.ts':
          return utils1File;
        case '/test/recursion2/libs/utils2.ts':
          return utils2File;
        case '/test/recursion2/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/recursion2/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/recursion2/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/recursion2/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/recursion2/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/recursion2/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Should detect recursive call and add error
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((error) =>
        error.includes('Recursive function call detected: utils1')
      )
    ).toBe(true);
    expect(
      errors.some((error) =>
        error.includes(
          'A static function cannot use recursive calls to construct its result'
        )
      )
    ).toBe(true);
  });

  it('should handle circular imports without infinite loop', () => {
    // Mock the file contents with circular imports but no function recursion
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 } from "./libs/utils1";

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
      export * from "./utils1";
      export * from "./utils3";
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

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/circular/libs/utils1.ts':
          return utils1File;
        case '/test/circular/libs/utils2.ts':
          return utils2File;
        case '/test/circular/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/circular/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/circular/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/circular/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/circular/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/circular/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Should work without errors (circular imports are handled, no function recursion)
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4); // Should still have 4 branches: utils3-a, utils3-b, utils1-a, utils1-b

    // Verify that all updates have the correct structure (same as original test)
    updates.forEach((update) => {
      expect(update.dataFormat).toBe('JSX');
      expect(Array.isArray(update.source)).toBe(true);
      expect(update.source).toHaveLength(2);
      expect(update.source[0]).toBe('test ');

      const staticComponent = update.source[1] as any;
      expect(staticComponent.t).toBe('Static');
      expect(staticComponent.i).toBe(1);
      expect(staticComponent.c).toMatch(/^(utils3-[ab]|utils1-[ab])$/);
    });

    // Verify specific content variations exist
    const staticContents = updates.map((u) => (u.source[1] as { c: string }).c);
    expect(staticContents).toContain('utils3-a');
    expect(staticContents).toContain('utils3-b');
    expect(staticContents).toContain('utils1-a');
    expect(staticContents).toContain('utils1-b');
  });

  it('should handle function resolution failure when import chain is broken', () => {
    // Mock the file contents with broken import chain
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 } from "./libs/utils1";

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
      export * from "./utils1";
      // export * from "./utils3";
    `;

    const utils3File = `
      export function utils3() {
        return 1 ? "utils3-a" : "utils3-b";
      }
    `;

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/broken/libs/utils1.ts':
          return utils1File;
        case '/test/broken/libs/utils2.ts':
          return utils2File;
        case '/test/broken/libs/utils3.ts':
          return utils3File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/broken/libs/utils1.ts';
        }
        if (importPath === './utils2') {
          return '/test/broken/libs/utils2.ts';
        }
        if (importPath === './utils3') {
          return '/test/broken/libs/utils3.ts';
        }
        if (importPath === './utils1') {
          return '/test/broken/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/broken/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Should have warnings about function not found
    expect(warnings.size).toBeGreaterThan(0);
    expect(
      Array.from(warnings).some((warning) =>
        warning.includes('Function utils3 definition could not be resolved')
      )
    ).toBe(true);
    expect(
      Array.from(warnings).some((warning) =>
        warning.includes('This might affect translation resolution')
      )
    ).toBe(true);

    // Should still process the parts that can be resolved (utils1-a, utils1-b)
    expect(updates.length).toBeGreaterThan(0);

    // Verify that utils1 was still processed despite utils3 resolution failure
    const staticContents = updates.map((u) => (u.source[1] as { c: string }).c);
    expect(staticContents).toContain('utils1-a');
    expect(staticContents).toContain('utils1-b');

    // Verify that files were attempted to be read
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/broken/libs/utils1.ts',
      'utf8'
    );
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/broken/libs/utils2.ts',
      'utf8'
    );
  });

  it('should handle undefined function binding and generate warning', () => {
    // Mock the file contents with undefined function call
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1, otherUtils } from "./libs/utils1";

      function getStatic() {
        return 1 ? "static" : "dynamic";
      }

      export default function Page() {
        return (
          <>
            <T>test <Static>{glorb()}</Static></T>
          </>
        );
      }
    `;

    const utils1File = `
      export function utils1() {
        return 1 ? "utils1-a" : "utils1-b";
      }
      
      export function otherUtils() {
        return 1 ? "otherUtils-a" : "otherUtils-b";
      }
    `;

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/undefined/libs/utils1.ts':
          return utils1File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/undefined/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/undefined/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Should have warnings about function not found
    expect(warnings.size).toBeGreaterThan(0);
    expect(
      Array.from(warnings).some((warning) =>
        warning.includes('Function glorb definition could not be resolved')
      )
    ).toBe(true);
    expect(
      Array.from(warnings).some((warning) =>
        warning.includes('This might affect translation resolution')
      )
    ).toBe(true);
    expect(
      Array.from(warnings).some((warning) =>
        warning.includes('/test/undefined/page.tsx')
      )
    ).toBe(true);

    // Should still create an update but with empty/null content for the Static component
    expect(updates.length).toBeGreaterThanOrEqual(1);

    // The Static component should be processed but the glorb() call should be null/empty
    const update = updates[0];
    expect(update.dataFormat).toBe('JSX');
    expect(update.source).toBeDefined();
  });

  it('should handle import aliases correctly', () => {
    // Mock the file contents with import aliases
    const pageFile = `
      import { T, Static } from "gt-next";
      import { utils1 as aliasUtils1, otherUtils } from "./libs/utils1";

      function getStatic() {
        return 1 ? "static" : "dynamic";
      }

      export default function Page() {
        return (
          <>
            <T>test <Static>{aliasUtils1()}</Static></T>
          </>
        );
      }
    `;

    const utils1File = `
      export function utils1() {
        // if (Math.random() > 0.5) {
        //   return aliasUtils3();
        // }
        return 1 ? "utils1-a" : "utils1-b";
      }
      
      export function otherUtils() {
        return 1 ? "otherUtils-a" : "otherUtils-b";
      }
    `;

    // Set up file system mocks (using unique paths for cache isolation)
    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      switch (path) {
        case '/test/aliases/libs/utils1.ts':
          return utils1File;
        default:
          throw new Error(`File not found: ${path}`);
      }
    });

    // Set up import path resolution mocks
    mockResolveImportPath.mockImplementation(
      (_currentFile: string, importPath: string) => {
        if (importPath === './libs/utils1') {
          return '/test/aliases/libs/utils1.ts';
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
        const tBinding = programPath.scope.getBinding(tLocalName);

        if (tBinding) {
          parseTranslationComponent({
            ast,
            pkgs: ['gt-next'],
            originalName: 'T',
            importAliases,
            localName: tLocalName,
            path: tBinding.path,
            updates,
            errors,
            warnings,
            file: '/test/aliases/page.tsx',
            parsingOptions,
          });
        }
      },
    });

    // Verify no errors occurred
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2); // Should have 2 branches: utils1-a, utils1-b

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

    // Expected hash-to-source mappings for alias scenario
    const expectedData = {
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
    expect(hashedUpdates.some((u) => u.hash === '40d52de32ba666ce')).toBe(true);
    expect(hashedUpdates.some((u) => u.hash === '081fa70a614caa27')).toBe(true);

    // Hard check: Verify each hash maps to the exact expected content
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

    // Verify that the aliased function was resolved correctly
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      '/test/aliases/libs/utils1.ts',
      'utf8'
    );
    expect(mockResolveImportPath).toHaveBeenCalledWith(
      '/test/aliases/page.tsx',
      './libs/utils1',
      parsingOptions,
      expect.any(Map)
    );

    // Verify specific content variations exist
    const staticContents = hashedUpdates.map(
      (u) => (u.source[1] as { c: string }).c
    );
    expect(staticContents).toContain('utils1-a');
    expect(staticContents).toContain('utils1-b');
  });
});
