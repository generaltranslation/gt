import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('generaltranslation/core export', () => {
  it('loads and formats from the built CJS subpath', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
          const assert = require('node:assert/strict');
          const {
            formatMessage,
            standardizeLocale,
          } = require('generaltranslation/core');

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(standardizeLocale('en-us'), 'en-US');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('loads and formats from the built ESM subpath', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import {
            LocaleConfig,
            formatCutoff,
            formatMessage,
            isValidLocale,
            resolveCanonicalLocale,
            standardizeLocale,
          } from 'generaltranslation/core';

          assert.equal(
            formatCutoff('Hello, world!', {
              locales: 'en-US',
              maxChars: 8,
            }),
            'Hello, \\u2026'
          );

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );

          assert.equal(
            new LocaleConfig().formatMessage('Hi {name}', undefined, {
              variables: { name: 'Ada' },
            }),
            'Hi Ada'
          );

          assert.equal(isValidLocale('en-US'), true);
          assert.equal(resolveCanonicalLocale('en-US'), 'en-US');
          assert.equal(standardizeLocale('en-us'), 'en-US');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('does not include internal-only dependencies in the built subpath graph', () => {
    const builtFiles = ['core.mjs', 'core.cjs'].flatMap((fileName) =>
      readBuiltFileGraph(fileName)
    );
    const builtGraph = builtFiles.join('\n');

    for (const forbidden of [
      '@noble/hashes',
      'stableStringify',
      'defaultBaseUrl',
      'defaultRuntimeApiUrl',
      'fetchWithTimeout',
      'apiRequest',
    ]) {
      expect(builtGraph).not.toContain(forbidden);
    }
  });
});

function readBuiltFileGraph(entryFileName: string) {
  const distDir = join(process.cwd(), 'dist');
  const pending = [join(distDir, entryFileName)];
  const visited = new Set<string>();
  const files: string[] = [];

  while (pending.length) {
    const filePath = pending.pop();
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);

    const file = readFileSync(filePath, 'utf8');
    files.push(file);

    for (const localImport of getLocalImports(file)) {
      const importedPath = join(dirname(filePath), localImport);
      if (existsSync(importedPath)) {
        pending.push(importedPath);
      }
    }
  }

  return files;
}

function getLocalImports(file: string) {
  return [
    ...file.matchAll(
      /\bfrom\s+['"](\.\/[^'"]+)['"]|\brequire\(['"](\.\/[^'"]+)['"]\)/g
    ),
  ]
    .map((match) => match[1] ?? match[2])
    .filter((importPath): importPath is string => !!importPath);
}
