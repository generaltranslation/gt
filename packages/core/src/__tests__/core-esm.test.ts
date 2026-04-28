import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('does not import generated shared chunks from the built subpath', () => {
    const builtFiles = ['core.mjs', 'core.cjs'].map((fileName) =>
      readFileSync(join(process.cwd(), 'dist', fileName), 'utf8')
    );

    for (const file of builtFiles) {
      expect(file).not.toMatch(/\bfrom\s+['"]\.\//);
      expect(file).not.toMatch(/\brequire\(['"]\.\//);
      expect(file).not.toContain('@noble/hashes');
      expect(file).not.toContain('stableStringify');
    }
  });
});
