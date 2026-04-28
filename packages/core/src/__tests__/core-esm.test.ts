import { execFileSync } from 'node:child_process';

import { describe, it } from 'vitest';

describe('generaltranslation/core ESM export', () => {
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
});
