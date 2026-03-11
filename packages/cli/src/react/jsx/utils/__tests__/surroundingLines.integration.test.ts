import { describe, it, expect, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseStrings } from '../parseStringFunction.js';
import { parseTranslationComponent } from '../jsxParsing/parseJsx.js';
import { Updates } from '../../../../types/index.js';

describe('sourceCode metadata integration', () => {
  const tempFiles: string[] = [];

  function writeTempFile(content: string): string {
    const filePath = path.join(
      os.tmpdir(),
      `gt-test-${Date.now()}-${Math.random().toString(36).slice(2)}.tsx`
    );
    fs.writeFileSync(filePath, content, 'utf8');
    tempFiles.push(filePath);
    return filePath;
  }

  afterEach(() => {
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
    tempFiles.length = 0;
  });

  it('should include sourceCode in metadata for gt() string calls', () => {
    const code = [
      'import { useGT } from "gt-next";',
      '',
      'function Page() {',
      '  const gt = useGT();',
      '  const name = "world";',
      '  const greeting = gt("Hello, {name}!");',
      '  return greeting;',
      '}',
    ].join('\n');

    const filePath = writeTempFile(code);
    const relativeFilePath = path.relative(process.cwd(), filePath);
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const updates: Updates = [];
    const errors: string[] = [];
    const warnings = new Set<string>();

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
            },
            { updates, errors, warnings }
          );
        }
      },
    });

    expect(updates).toHaveLength(1);
    expect(errors).toHaveLength(0);

    const { sourceCode } = updates[0].metadata;
    expect(sourceCode).toBeDefined();
    expect(sourceCode[relativeFilePath]).toBeDefined();
    expect(sourceCode[relativeFilePath]).toHaveLength(1);

    const entry = sourceCode[relativeFilePath][0];
    expect(entry.target).toContain('gt("Hello, {name}!")');
    expect(entry.before).toContain('const name = "world"');
    expect(entry.after).toContain('return greeting');
  });

  it('should include sourceCode in metadata for <T> components', () => {
    const code = [
      'import { T } from "gt-next";',
      '',
      'function Page() {',
      '  const name = "world";',
      '  return (',
      '    <T>',
      '      <div>Hello, world!</div>',
      '    </T>',
      '  );',
      '}',
    ].join('\n');

    const filePath = writeTempFile(code);
    const relativeFilePath = path.relative(process.cwd(), filePath);
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const updates: Updates = [];
    const errors: string[] = [];
    const warnings = new Set<string>();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'T' &&
          t.isIdentifier(path.node.local)
        ) {
          parseTranslationComponent({
            originalName: 'T',
            localName: path.node.local.name,
            path,
            updates,
            config: {
              parsingOptions: { conditionNames: [] },
              importAliases: { T: 'T' },
              pkgs: ['gt-next'],
              file: filePath,
            },
            output: {
              errors,
              warnings,
              unwrappedExpressions: [],
            },
          });
        }
      },
    });

    expect(updates).toHaveLength(1);
    expect(errors).toHaveLength(0);

    const { sourceCode } = updates[0].metadata;
    expect(sourceCode).toBeDefined();
    expect(sourceCode[relativeFilePath]).toBeDefined();

    const entry = sourceCode[relativeFilePath][0];
    expect(entry.target).toContain('<T>');
    expect(entry.target).toContain('</T>');
    expect(entry.before).toContain('return (');
    expect(entry.after).toContain(');');
  });

  it('should handle file at top with fewer lines above than requested', () => {
    const code = [
      'import { useGT } from "gt-next";',
      'const gt = useGT();',
      'const x = gt("top of file");',
    ].join('\n');

    const filePath = writeTempFile(code);
    const relativeFilePath = path.relative(process.cwd(), filePath);
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const updates: Updates = [];
    const errors: string[] = [];
    const warnings = new Set<string>();

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
            },
            { updates, errors, warnings }
          );
        }
      },
    });

    expect(updates).toHaveLength(1);
    const { sourceCode } = updates[0].metadata;
    expect(sourceCode).toBeDefined();

    const entry = sourceCode[relativeFilePath][0];
    expect(entry.target).toContain('gt("top of file")');
    expect(entry.before.split('\n').length).toBeLessThanOrEqual(3);
  });
});
