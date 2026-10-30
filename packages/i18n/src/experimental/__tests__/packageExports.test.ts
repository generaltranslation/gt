/**
 * Locale twins are experimental: their runtime and SPA document helpers are
 * published only from `gt-i18n/internal/experimental`, in both module
 * formats, and the regular entry points carry none of them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));

const TWIN_EXPORTS = [
  'GtInternalRegisterLocaleTwin',
  'createLocaleTwinDocument',
  'getGTInternal',
  'getLocaleTwinCacheParams',
  'getMessagesInternal',
  'initializeLocaleTwins',
  'markNavigatingReload',
  'msg',
  'resolveLocaleTwinLookup',
  'withLocaleTwinReload',
];

const TWIN_ONLY_EXPORTS = TWIN_EXPORTS.filter(
  (name) => !['getGTInternal', 'getMessagesInternal', 'msg'].includes(name)
);

function run(format: 'esm' | 'cjs', body: string): void {
  const script = body.replace(/LOAD\('([^']+)'\)/g, (_match, specifier) =>
    format === 'esm'
      ? `await import('${specifier}')`
      : `require('${specifier}')`
  );
  execFileSync(
    process.execPath,
    format === 'esm'
      ? ['--input-type=module', '--eval', script]
      : [
          '--eval',
          `(async () => { ${script} })().catch((error) => { console.error(error); process.exit(1); });`,
        ],
    { cwd: packageRoot, stdio: 'pipe' }
  );
}

// Each test starts a Node process that loads the built package, which can
// take several seconds on a busy CI runner.
describe('gt-i18n/internal/experimental', { timeout: 30_000 }, () => {
  it.each(['esm', 'cjs'] as const)(
    'exports the locale twin runtime (%s)',
    (format) => {
      run(
        format,
        `
          const experimental = LOAD('gt-i18n/internal/experimental');
          const missing = ${JSON.stringify(TWIN_EXPORTS)}.filter(
            (name) => typeof experimental[name] !== 'function'
          );
          if (missing.length) throw new Error('missing: ' + missing.join(', '));
          if (experimental.GtInternalRegisterLocaleTwin(JSON.stringify({ l: 'fr', e: {} })) !== true) {
            throw new Error('a twin table did not register');
          }
        `
      );
    }
  );

  it.each(['esm', 'cjs'] as const)(
    'keeps locale twins out of the regular entry points (%s)',
    (format) => {
      run(
        format,
        `
          for (const specifier of ['gt-i18n', 'gt-i18n/internal']) {
            const module = specifier === 'gt-i18n' ? LOAD('gt-i18n') : LOAD('gt-i18n/internal');
            const leaked = ${JSON.stringify(TWIN_ONLY_EXPORTS)}.filter((name) => name in module);
            if (leaked.length) throw new Error(specifier + ' leaked: ' + leaked.join(', '));
          }
        `
      );
    }
  );

  it('no longer publishes gt-i18n/internal/locale-twins', () => {
    expect(() =>
      run('cjs', `LOAD('gt-i18n/internal/locale-twins');`)
    ).toThrow();
  });

  it('publishes declarations for both module formats', () => {
    for (const file of [
      'dist/internal-experimental.d.cts',
      'dist/internal-experimental.d.mts',
    ]) {
      expect(existsSync(join(packageRoot, file)), file).toBe(true);
    }
  });
});
