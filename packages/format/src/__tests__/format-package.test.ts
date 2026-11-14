import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

// These tests load the built package through its own exports map.
describe('@generaltranslation/format package exports', () => {
  beforeAll(() => {
    // Turbo builds this package before its tests. A standalone run rebuilds,
    // so the entrypoints exist and match the current sources.
    if (process.env.TURBO_HASH) return;

    // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
    // a native binary (mise-installed pnpm, runnable directly).
    const npmExecpath = process.env.npm_execpath;
    const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
    const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
    const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];
    execFileSync(command, args, {
      cwd: packageRoot,
      stdio: 'pipe',
      timeout: 60_000,
    });
  }, 65_000);

  it('loads and formats from the built CJS entrypoints', () => {
    const require = createRequire(import.meta.url);
    const format = require('@generaltranslation/format');
    const { HTML_CONTENT_PROPS } = require('@generaltranslation/format/types');
    const {
      getCachedPluralRules,
    } = require('@generaltranslation/format/internal');

    const locales = 'en';
    const now = Date.now();
    expect(
      format.formatMessage('Hi {name}', {
        locales,
        variables: { name: 'Ada' },
        timeZone: 'UTC',
      })
    ).toBe('Hi Ada');
    expect(format.formatCutoff('Hello, world!', { locales, maxChars: 8 })).toBe(
      'Hello, …'
    );
    expect(format.formatNum(1234.5, { locales })).toBe('1,234.5');
    expect(format.formatCurrency(1234.5, 'USD', { locales })).toBe('$1,234.50');
    expect(format.formatList(['apples', 'bananas'], { locales })).toBe(
      'apples and bananas'
    );
    expect(format.formatRelativeTime(-1, 'day', { locales })).toBe('yesterday');
    expect(
      format.formatRelativeTimeFromDate(new Date(now - 86_400_000), {
        locales,
        baseDate: new Date(now),
      })
    ).toBe('yesterday');
    expect(
      new format.GTIntl(
        { defaultLocale: 'en', timeZone: 'UTC' },
        { locale: 'en-US' }
      ).formatNum(1234.5)
    ).toBe('1,234.5');
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
            GTIntl,
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

          const now = Date.now();
          assert.equal(
            formatMessage('Hi {name}', { locales: 'en', variables: { name: 'Ada' }, timeZone: 'UTC' }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { locales: 'en', maxChars: 8 }), 'Hello, …');
          assert.equal(formatNum(1234.5, { locales: 'en' }), '1,234.5');
          assert.equal(formatCurrency(1234.5, 'USD', { locales: 'en' }), '$1,234.50');
          assert.equal(formatList(['apples', 'bananas'], { locales: 'en' }), 'apples and bananas');
          assert.equal(formatRelativeTime(-1, 'day', { locales: 'en' }), 'yesterday');
          assert.equal(
            formatRelativeTimeFromDate(new Date(now - 86_400_000), { locales: 'en', baseDate: new Date(now) }),
            'yesterday'
          );
          assert.equal(
            new GTIntl({ defaultLocale: 'en', timeZone: 'UTC', customMapping: { en: 'English' } }).getLocaleName('en'),
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
