import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { parseStrings, clearParsingCaches } from '../parseStringFunction.js';
import { resolveImportPath } from '../resolveImportPath.js';
import { Updates } from '../../../../types/index.js';

const traverse = (traverseModule as any).default || traverseModule;

vi.mock('node:fs');
vi.mock('../resolveImportPath.js');

const mockFs = vi.mocked(fs);
const mockResolveImportPath = vi.mocked(resolveImportPath);

describe('parseStrings — cross-file gt parameter tracing', () => {
  let updates: Updates;
  let errors: string[];
  let warnings: Set<string>;

  beforeEach(() => {
    updates = [];
    errors = [];
    warnings = new Set();
    vi.clearAllMocks();
    clearParsingCaches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function extractStrings(sourceCode: string, filePath: string) {
    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            {
              parsingOptions: { conditionNames: [] },
              file: filePath,
              ignoreInlineMetadata: false,
              ignoreDynamicContent: false,
              ignoreInvalidIcu: false,
              ignoreInlineListContent: true,
              includeSourceCodeContext: false,
              ignoreTaggedTemplates: false,
              ignoreGlobalTaggedTemplates: false,
              autoderiveMethod: 'DISABLED',
            },
            {
              updates,
              errors,
              warnings,
            }
          );
        }
      },
    });
  }

  it('should trace gt parameter through a 3-file chain with relative imports', () => {
    // file1.tsx imports getDetails from file2, which imports getLabel from file3
    // gt is passed: file1 → file2 → file3
    const file1 = `
      import { useGT } from 'gt-react';
      import { getDetails } from '@app/utils';

      function Component() {
        const gt = useGT();
        getDetails(gt);
      }
    `;

    const file2 = `
      import { getLabel } from './helpers';

      export function getDetails(gt) {
        gt('detail string', { $id: 'detail' });
        getLabel(gt);
      }
    `;

    const file3 = `
      export function getLabel(gt) {
        gt('label string', { $id: 'label' });
      }
    `;

    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      if (path === '/project/src/utils.ts') return file2;
      if (path === '/project/src/helpers.ts') return file3;
      throw new Error(`File not found: ${path}`);
    });
    mockResolveImportPath.mockImplementation(
      (currentFile: string, importPath: string) => {
        if (importPath === '@app/utils') return '/project/src/utils.ts';
        // This is the key: ./helpers must be resolved relative to utils.ts, not file1.tsx
        if (
          currentFile === '/project/src/utils.ts' &&
          importPath === './helpers'
        )
          return '/project/src/helpers.ts';
        return null;
      }
    );

    extractStrings(file1, '/project/app/page.tsx');

    expect(errors).toHaveLength(0);
    // Should find strings in both file2 and file3
    expect(updates).toHaveLength(2);

    const ids = updates.map((u) => u.metadata.id);
    expect(ids).toContain('detail');
    expect(ids).toContain('label');
  });

  it('should fail to trace 3-file chain when config.file is not updated (regression guard)', () => {
    // This test verifies that resolveImportPath is called with the correct
    // currentFile for nested cross-file resolution.
    const file1 = `
      import { useGT } from 'gt-react';
      import { outer } from '@pkg/outer';

      function Component() {
        const gt = useGT();
        outer(gt);
      }
    `;

    const file2 = `
      import { inner } from './inner';

      export function outer(gt) {
        inner(gt);
      }
    `;

    const file3 = `
      export function inner(gt) {
        gt('inner string', { $id: 'inner' });
      }
    `;

    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      if (path === '/pkg/src/outer.ts') return file2;
      if (path === '/pkg/src/inner.ts') return file3;
      throw new Error(`File not found: ${path}`);
    });
    mockResolveImportPath.mockImplementation(
      (currentFile: string, importPath: string) => {
        if (importPath === '@pkg/outer') return '/pkg/src/outer.ts';
        // Only resolve ./inner when called with the correct currentFile (outer.ts)
        if (currentFile === '/pkg/src/outer.ts' && importPath === './inner')
          return '/pkg/src/inner.ts';
        return null;
      }
    );

    extractStrings(file1, '/app/page.tsx');

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].metadata.id).toBe('inner');

    // Verify resolveImportPath was called with the correct file for nested resolution
    const resolveImportPathCalls = mockResolveImportPath.mock.calls;
    const innerResolutionCall = resolveImportPathCalls.find(
      (call) => call[1] === './inner'
    );
    expect(innerResolutionCall).toBeDefined();
    expect(innerResolutionCall![0]).toBe('/pkg/src/outer.ts');
  });

  it('should trace gt through re-exports in a 3-file chain', () => {
    const file1 = `
      import { useGT } from 'gt-react';
      import { process } from '@lib/index';

      function Component() {
        const gt = useGT();
        process(gt);
      }
    `;

    const indexFile = `
      export { process } from './processor';
    `;

    const processorFile = `
      export function process(gt) {
        gt('processed', { $id: 'processed' });
      }
    `;

    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      if (path === '/lib/src/index.ts') return indexFile;
      if (path === '/lib/src/processor.ts') return processorFile;
      throw new Error(`File not found: ${path}`);
    });
    mockResolveImportPath.mockImplementation(
      (currentFile: string, importPath: string) => {
        if (importPath === '@lib/index') return '/lib/src/index.ts';
        if (currentFile === '/lib/src/index.ts' && importPath === './processor')
          return '/lib/src/processor.ts';
        return null;
      }
    );

    extractStrings(file1, '/app/page.tsx');

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].metadata.id).toBe('processed');
  });

  it('should handle gt with default value parameter across files', () => {
    // Mirrors the real-world case: gt = gtFallback default parameter
    const file1 = `
      import { useGT } from 'gt-react';
      import { getCopy } from '@app/copy';

      function Component() {
        const gt = useGT();
        getCopy(gt);
      }
    `;

    const file2 = `
      import { formatCopy } from './format';

      export function getCopy(gt = fallback) {
        gt('direct copy', { $id: 'direct' });
        formatCopy(gt);
      }
    `;

    const file3 = `
      export function formatCopy(gt = fallback) {
        gt('formatted copy', { $id: 'formatted' });
      }
    `;

    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      if (path === '/app/src/copy.ts') return file2;
      if (path === '/app/src/format.ts') return file3;
      throw new Error(`File not found: ${path}`);
    });
    mockResolveImportPath.mockImplementation(
      (currentFile: string, importPath: string) => {
        if (importPath === '@app/copy') return '/app/src/copy.ts';
        if (currentFile === '/app/src/copy.ts' && importPath === './format')
          return '/app/src/format.ts';
        return null;
      }
    );

    extractStrings(file1, '/app/pages/page.tsx');

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const ids = updates.map((u) => u.metadata.id);
    expect(ids).toContain('direct');
    expect(ids).toContain('formatted');
  });

  describe('warnUnresolvedImportSync', () => {
    it('should warn when an imported function receiving gt cannot be resolved', () => {
      const file1 = `
        import { useGT } from 'gt-react';
        import { getData } from '@app/data';

        function Component() {
          const gt = useGT();
          getData(gt);
        }
      `;

      // Resolve returns null for @app/data
      mockResolveImportPath.mockReturnValue(null);

      extractStrings(file1, '/app/page.tsx');

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(0);
      expect(warnings.size).toBe(1);
      const warning = [...warnings][0];
      expect(warning).toContain('getData');
      expect(warning).toContain('@app/data');
    });

    it('should warn when a nested cross-file import cannot be resolved', () => {
      const file1 = `
        import { useGT } from 'gt-react';
        import { outer } from '@pkg/outer';

        function Component() {
          const gt = useGT();
          outer(gt);
        }
      `;

      const file2 = `
        import { inner } from './missing-file';

        export function outer(gt) {
          gt('found', { $id: 'found' });
          inner(gt);
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/pkg/src/outer.ts') return file2;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === '@pkg/outer') return '/pkg/src/outer.ts';
          // ./missing-file cannot be resolved
          if (importPath === './missing-file') return null;
          return null;
        }
      );

      extractStrings(file1, '/app/page.tsx');

      expect(errors).toHaveLength(0);
      // Should still extract the string from file2
      expect(updates).toHaveLength(1);
      expect(updates[0].metadata.id).toBe('found');
      // Should warn about the unresolved inner import
      expect(warnings.size).toBe(1);
      const warning = [...warnings][0];
      expect(warning).toContain('inner');
      expect(warning).toContain('./missing-file');
    });

    it('should not warn when all imports resolve successfully', () => {
      const file1 = `
        import { useGT } from 'gt-react';
        import { helper } from '@app/helper';

        function Component() {
          const gt = useGT();
          helper(gt);
        }
      `;

      const file2 = `
        export function helper(gt) {
          gt('works', { $id: 'works' });
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/app/src/helper.ts') return file2;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === '@app/helper') return '/app/src/helper.ts';
          return null;
        }
      );

      extractStrings(file1, '/app/page.tsx');

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
      expect(warnings.size).toBe(0);
    });
  });
});
