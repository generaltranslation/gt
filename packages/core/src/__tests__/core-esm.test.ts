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
          import { LocaleConfig, formatMessage } from 'generaltranslation/core';

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
        `,
      ],
      { stdio: 'pipe' }
    );
  });
});
