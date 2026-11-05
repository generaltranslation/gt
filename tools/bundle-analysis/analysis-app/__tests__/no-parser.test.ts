import { join } from 'node:path';
import { build, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { packagesDir } from '../server/workspace.ts';

// Only the ICU string parser contains this error code.
const PARSER_MARKER = 'UNMATCHED_CLOSING_TAG';

// Framework peers stay external; GT packages and their dependencies are inlined.
const PEER =
  /^(react|react-dom|react-native|next|server-only|vite|@tanstack\/.*)(\/|$)/;

const fixturesDir = join(import.meta.dirname, 'fixtures/no-parser');

/** Bundles an entry with every non-peer dependency inlined and returns the code. */
async function bundle(entry: string, conditions?: string[]): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    ...(conditions && { resolve: { conditions } }),
    build: {
      write: false,
      minify: false,
      sourcemap: false,
      lib: { entry, formats: ['es'], fileName: 'bundle' },
      rolldownOptions: { external: (id) => PEER.test(id) },
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

async function expectParser(
  fixture: string,
  conditions: string[],
  included: boolean
) {
  const code = await bundle(join(fixturesDir, fixture), conditions);
  expect(code).toContain('gt-i18n.unstable.placeholder');
  expect(code.includes(PARSER_MARKER)).toBe(included);
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

describe('framework /unstable bundles', () => {
  it.each([
    ['@generaltranslation/react-core/unstable', 'react-core.ts', ['browser']],
    ['gt-react/unstable (client)', 'gt-react.ts', ['browser']],
    ['gt-react/unstable (react-server)', 'gt-react.ts', ['react-server']],
    ['gt-next/unstable (client)', 'gt-next.ts', ['browser']],
    ['gt-next/unstable (ssr)', 'gt-next.ts', ['node']],
    ['gt-next/unstable (react-server)', 'gt-next.ts', ['react-server']],
    ['gt-next/unstable/server', 'gt-next-server.ts', ['react-server']],
    ['gt-node/unstable', 'gt-node.ts', ['node']],
    ['gt-react-native/unstable', 'gt-react-native.ts', ['react-native']],
    [
      'gt-tanstack-start/unstable (client)',
      'gt-tanstack-start.ts',
      ['browser'],
    ],
    ['gt-tanstack-start/unstable (server)', 'gt-tanstack-start.ts', ['node']],
  ])('%s does not include the ICU string parser', (_, fixture, conditions) =>
    expectParser(fixture, conditions, false)
  );
});

// Legacy root entries format ICU messages, so they must keep the parser.
describe('legacy root bundles', () => {
  it.each([
    [
      '@generaltranslation/format',
      join(packagesDir, 'format/dist/index.mjs'),
      undefined,
    ],
    ['gt-react (client)', join(fixturesDir, 'gt-react-root.ts'), ['browser']],
  ])('%s includes the ICU string parser', async (_, entry, conditions) => {
    const code = await bundle(entry, conditions);
    expect(code).toContain(PARSER_MARKER);
  });
});
