/**
 * Locale twins are experimental: their cross-package internals are published
 * only from `generaltranslation/internal/experimental`, in both module
 * formats, and the regular entry points carry none of them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));

const TWIN_EXPORTS = [
  'encodeLocaleTwinPlaceholder',
  'findLocaleTwinPlaceholders',
  'parseLocaleTwinManifest',
  'parseLocaleTwinTable',
  'resolveTranslationSplitting',
  'serializeLocaleTwinTable',
];

function run(format: 'esm' | 'cjs', body: string): void {
  const load =
    format === 'esm'
      ? (specifier: string) => `await import('${specifier}')`
      : (specifier: string) => `require('${specifier}')`;
  const script = body.replace(/LOAD\('([^']+)'\)/g, (_match, specifier) =>
    load(specifier)
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
describe(
  'generaltranslation/internal/experimental',
  { timeout: 30_000 },
  () => {
    it.each(['esm', 'cjs'] as const)(
      'exports the locale twin internals (%s)',
      (format) => {
        run(
          format,
          `
        const experimental = LOAD('generaltranslation/internal/experimental');
        for (const name of ${JSON.stringify(TWIN_EXPORTS)}) {
          if (typeof experimental[name] !== 'function') throw new Error('missing ' + name);
        }
        if (experimental.resolveTranslationSplitting({ experimental: { splitting: 'locale-twins' } }) !== 'locale-twins') {
          throw new Error('experimental.splitting is not read');
        }
      `
        );
      }
    );

    it.each(['esm', 'cjs'] as const)(
      'keeps locale twins out of generaltranslation/internal (%s)',
      (format) => {
        run(
          format,
          `
          const internal = LOAD('generaltranslation/internal');
          const leaked = ${JSON.stringify(TWIN_EXPORTS)}.filter((name) => name in internal);
          if (leaked.length) throw new Error('leaked: ' + leaked.join(', '));
        `
        );
      }
    );

    it('publishes declarations for both module formats', () => {
      for (const file of [
        'dist/internal-experimental.d.cts',
        'dist/internal-experimental.d.mts',
      ]) {
        expect(existsSync(join(packageRoot, file)), file).toBe(true);
      }
    });
  }
);
