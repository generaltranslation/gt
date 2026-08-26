import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function resolveExport(specifier: string) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `console.log(import.meta.resolve('${specifier}'))`,
    ],
    { cwd: packageRoot, encoding: 'utf8' }
  );
}

describe('@generaltranslation/utils package exports', () => {
  it('only exposes utilities through subpaths', () => {
    expect(resolveExport('@generaltranslation/utils').status).not.toBe(0);
    expect(resolveExport('@generaltranslation/utils/diagnostics').status).toBe(
      0
    );
  });
});
