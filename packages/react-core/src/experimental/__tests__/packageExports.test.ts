import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url))))
);

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

// Each test starts a Node process that loads the built package, which can
// take several seconds on a busy CI runner.
describe(
  '@generaltranslation/react-core/internal/experimental',
  { timeout: 30_000 },
  () => {
    const twinExports = [
      'GtInternalRegisterLocaleTwin',
      'GtInternalTranslateJsx',
      'T',
      'internalInitializeGTSRA',
      'markNavigatingReload',
      'msg',
      't',
      'useGT',
      'useMessages',
      'withLocaleTwinReload',
    ];
    const twinOnlyExports = [
      'GtInternalRegisterLocaleTwin',
      'markNavigatingReload',
      'withLocaleTwinReload',
    ];
    const regularEntries = ['pure', 'components', 'hooks', 'components-rsc'];

    beforeAll(() => {
      if (
        existsSync(join(packageRoot, 'dist/experimental/internal.cjs')) &&
        existsSync(join(packageRoot, 'dist/experimental/internal.mjs'))
      ) {
        return;
      }
      buildPackage();
    });

    it.each([
      [
        'cjs',
        `const experimental = require('@generaltranslation/react-core/internal/experimental');`,
      ],
      [
        'esm',
        `const experimental = await import('@generaltranslation/react-core/internal/experimental');`,
      ],
    ])('exports the locale twin React runtime (%s)', (format, load) => {
      node([
        ...(format === 'esm' ? ['--input-type=module'] : []),
        '-e',
        `
        (async () => {
          ${load}
          const missing = ${JSON.stringify(twinExports)}.filter(
            (name) => typeof experimental[name] !== 'function'
          );
          if (missing.length) throw new Error('missing: ' + missing.join(', '));
        })().catch((error) => { console.error(error); process.exit(1); });
      `,
      ]);
    });

    it('keeps locale twins out of the regular entrypoints', () => {
      node([
        '-e',
        `
        for (const entry of ${JSON.stringify(regularEntries)}) {
          const module = require('@generaltranslation/react-core/' + entry);
          const leaked = ${JSON.stringify(twinOnlyExports)}.filter((name) => name in module);
          if (leaked.length) throw new Error(entry + ' leaked: ' + leaked.join(', '));
        }
      `,
      ]);
    });

    it('publishes declarations for both module formats', () => {
      for (const file of [
        'dist/experimental/internal.d.ts',
        'dist/experimental/internal.d.mts',
      ]) {
        expect(existsSync(join(packageRoot, file)), file).toBe(true);
      }
    });
  }
);
