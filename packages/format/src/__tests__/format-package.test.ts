import { execFileSync } from 'node:child_process';

import { describe, it } from 'vitest';

import type { CustomMapping } from 'gt-format/types';

describe('gt-format package export', () => {
  it('loads and formats from the built CJS entrypoint', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
          const assert = require('node:assert/strict');
          const {
            LocaleConfig,
            formatCutoff,
            formatMessage,
            getRegionProperties,
            standardizeLocale,
          } = require('gt-format');

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { maxChars: 8 }), 'Hello, …');
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
            formatCutoff,
            formatMessage,
            getRegionProperties,
            isValidLocale,
            resolveCanonicalLocale,
          } from 'gt-format';

          assert.equal(
            formatMessage('Hi {name}', { variables: { name: 'Ada' } }),
            'Hi Ada'
          );
          assert.equal(formatCutoff('Hello, world!', { maxChars: 8 }), 'Hello, …');
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

  it('resolves exported types from gt-format/types', () => {
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
          import { HTML_CONTENT_PROPS } from 'gt-format/types';

          assert.equal(HTML_CONTENT_PROPS.pl, 'placeholder');
        `,
      ],
      { stdio: 'pipe' }
    );

    if (!customMapping.pirate) {
      throw new Error('CustomMapping type import did not compile');
    }
  });
});
