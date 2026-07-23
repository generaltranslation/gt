import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CustomMapping } from '@generaltranslation/format/types';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const builtArtifacts = [
  'dist/index.cjs',
  'dist/index.mjs',
  'dist/types.mjs',
  'dist/internal.mjs',
].map((artifact) => join(packageRoot, artifact));

function hasBuiltArtifacts(): boolean {
  return builtArtifacts.every((artifact) => existsSync(artifact));
}

function buildPackage(): void {
  if (process.env.npm_execpath) {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
      cwd: packageRoot,
      stdio: 'pipe',
    });
    return;
  }
  execFileSync('pnpm', ['run', 'build'], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

describe('@generaltranslation/format package export', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  it('loads and formats from the built CJS entrypoint', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
          const assert = require('node:assert/strict');
          const {
            formatCurrency,
            LocaleConfig,
            formatCutoff,
            formatList,
            formatMessage,
            formatNum,
            formatRelativeTime,
            formatRelativeTimeFromDate,
            getRegionProperties,
            standardizeLocale,
          } = require('@generaltranslation/format');

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { maxChars: 8 }), 'Hello, …');
          assert.equal(formatNum(1234.5), '1,234.5');
          assert.equal(formatCurrency(1234.5, 'USD'), '$1,234.50');
          assert.equal(formatList(['apples', 'bananas']), 'apples and bananas');
          assert.equal(formatRelativeTime(-1, 'day'), 'yesterday');
          const relativeFromDate = formatRelativeTimeFromDate(
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            undefined,
          );
          assert.equal(typeof relativeFromDate, 'string');
          assert.equal(new LocaleConfig().formatNum(1234.5, 'en-US'), '1,234.5');
          assert.equal(getRegionProperties('US').name, 'United States');
          assert.equal(standardizeLocale('en-us'), 'en-US');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('loads and formats from the built ESM entrypoint', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import {
            LocaleConfig,
            formatCurrency,
            formatCutoff,
            formatList,
            formatMessage,
            formatNum,
            formatRelativeTime,
            formatRelativeTimeFromDate,
            getRegionProperties,
            isValidLocale,
            resolveCanonicalLocale,
          } from '@generaltranslation/format';

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { maxChars: 8 }), 'Hello, …');
          assert.equal(formatNum(1234.5), '1,234.5');
          assert.equal(formatCurrency(1234.5, 'USD'), '$1,234.50');
          assert.equal(formatList(['apples', 'bananas']), 'apples and bananas');
          assert.equal(formatRelativeTime(-1, 'day'), 'yesterday');
          const relativeFromDate = formatRelativeTimeFromDate(
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            undefined,
          );
          assert.equal(typeof relativeFromDate, 'string');
          assert.equal(
            new LocaleConfig({ customMapping: { en: 'English' } }).getLocaleName('en'),
            'English'
          );
          assert.equal(getRegionProperties('419').emoji, '🌎');
          assert.equal(isValidLocale('en-US'), true);
          assert.equal(resolveCanonicalLocale('en-US'), 'en-US');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('resolves exported types from @generaltranslation/format/types', () => {
    const customMapping: CustomMapping = {
      pirate: {
        code: 'en-US',
        name: 'Pirate',
      },
    };

    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';

          assert.equal(HTML_CONTENT_PROPS.pl, 'placeholder');
        `,
      ],
      { stdio: 'pipe' }
    );

    if (!customMapping.pirate) {
      throw new Error('CustomMapping type import did not compile');
    }
  });

  it('loads cached PluralRules from the built internal entrypoint', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { getCachedPluralRules } from '@generaltranslation/format/internal';

          const first = getCachedPluralRules(['en']);
          const second = getCachedPluralRules(['en']);

          assert.equal(first, second);
          assert.equal(first.select(1), 'one');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('keeps the custom cutoff formatter out of the native Intl cache chunk', () => {
    const intlCacheArtifacts = readdirSync(join(packageRoot, 'dist')).filter(
      (artifact) => /^IntlCache-.*\.(?:cjs|mjs)$/.test(artifact)
    );

    expect(
      new Set(intlCacheArtifacts.map((artifact) => artifact.split('.').at(-1)))
    ).toEqual(new Set(['cjs', 'mjs']));
    for (const artifact of intlCacheArtifacts) {
      expect(
        readFileSync(join(packageRoot, 'dist', artifact), 'utf8')
      ).not.toContain('CutoffFormat');
    }
  });
});
