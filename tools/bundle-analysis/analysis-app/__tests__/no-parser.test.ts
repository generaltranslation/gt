import { join } from 'node:path';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { packagesDir } from '../server/workspace.ts';

// Only the ICU string parser contains this error code.
const PARSER_MARKER = 'UNMATCHED_CLOSING_TAG';

/** Bundles a built entry with every dependency inlined and returns the code. */
async function bundle(entry: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      lib: { entry, formats: ['es'], fileName: 'bundle' },
    },
  });
  const outputs = (
    Array.isArray(result) ? result : [result]
  ) as Rollup.RollupOutput[];
  return outputs
    .flatMap((output) => output.output)
    .map((chunk) => ('code' in chunk ? chunk.code : ''))
    .join('\n');
}

describe('gt-i18n/unstable bundle', () => {
  it('does not include the ICU string parser', async () => {
    const parser = await bundle(join(packagesDir, 'icu/dist/parser.mjs'));
    expect(parser).toContain(PARSER_MARKER);
    const code = await bundle(join(packagesDir, 'i18n/dist/unstable.mjs'));
    expect(code).toContain('gt-i18n.unstable.placeholder');
    expect(code).not.toContain(PARSER_MARKER);
  });
});
