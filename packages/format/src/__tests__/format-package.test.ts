import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

// These tests load the built package through its own exports map, so `dist`
// must exist. Turbo builds before `test`; run `pnpm build` first otherwise.
describe('@generaltranslation/format package exports', () => {
  it('loads and formats from the built CJS entrypoints', () => {
    const require = createRequire(import.meta.url);
    const format = require('@generaltranslation/format');
    const { HTML_CONTENT_PROPS } = require('@generaltranslation/format/types');
    const {
      getCachedPluralRules,
    } = require('@generaltranslation/format/internal');

    expect(
      format.formatMessage('Hi {name}', { variables: { name: 'Ada' } })
    ).toBe('Hi Ada');
    expect(format.formatCutoff('Hello, world!', { maxChars: 8 })).toBe(
      'Hello, …'
    );
    expect(format.formatNum(1234.5)).toBe('1,234.5');
    expect(format.formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(format.formatList(['apples', 'bananas'])).toBe('apples and bananas');
    expect(format.formatRelativeTime(-1, 'day')).toBe('yesterday');
    expect(
      format.formatRelativeTimeFromDate(new Date(Date.now() - 86_400_000))
    ).toBe('yesterday');
    expect(new format.LocaleConfig().formatNum(1234.5, 'en-US')).toBe(
      '1,234.5'
    );
    expect(format.getRegionProperties('US').name).toBe('United States');
    expect(format.standardizeLocale('en-us')).toBe('en-US');
    expect(HTML_CONTENT_PROPS.pl).toBe('placeholder');
    expect(getCachedPluralRules(['en'])).toBe(getCachedPluralRules(['en']));
  });

  it('loads and formats from the built ESM entrypoints', () => {
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
          import { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';
          import { getCachedPluralRules } from '@generaltranslation/format/internal';

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { maxChars: 8 }), 'Hello, …');
          assert.equal(formatNum(1234.5), '1,234.5');
          assert.equal(formatCurrency(1234.5, 'USD'), '$1,234.50');
          assert.equal(formatList(['apples', 'bananas']), 'apples and bananas');
          assert.equal(formatRelativeTime(-1, 'day'), 'yesterday');
          assert.equal(
            formatRelativeTimeFromDate(new Date(Date.now() - 86_400_000)),
            'yesterday'
          );
          assert.equal(
            new LocaleConfig({ customMapping: { en: 'English' } }).getLocaleName('en'),
            'English'
          );
          assert.equal(getRegionProperties('419').emoji, '🌎');
          assert.equal(isValidLocale('en-US'), true);
          assert.equal(resolveCanonicalLocale('en-US'), 'en-US');
          assert.equal(HTML_CONTENT_PROPS.pl, 'placeholder');

          const pluralRules = getCachedPluralRules(['en']);
          assert.equal(pluralRules, getCachedPluralRules(['en']));
          assert.equal(pluralRules.select(1), 'one');
        `,
      ],
      { cwd: packageRoot, stdio: 'pipe' }
    );
  });
});
