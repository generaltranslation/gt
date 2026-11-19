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
  expect(code).toContain('gt-i18n.placeholder');
  expect(code.includes(PARSER_MARKER)).toBe(included);
}

describe('gt-i18n bundle', () => {
  it('does not include the ICU string parser', async () => {
    const parser = await bundle(join(packagesDir, 'icu/dist/parser.mjs'));
    expect(parser).toContain(PARSER_MARKER);
    const code = await bundle(join(packagesDir, 'i18n/dist/index.mjs'));
    expect(code).toContain('gt-i18n.placeholder');
    expect(code).not.toContain(PARSER_MARKER);
  });
});

describe('gt-i18n/internal/string bundle', () => {
  it('does not include the ICU string parser in what gt-vue imports', async () => {
    const code = await bundle(join(fixturesDir, 'gt-vue-strings.ts'));
    expect(code).toContain('hashStringMessage');
    expect(code).not.toContain(PARSER_MARKER);
  });
});

// Each fixture names the entry's message API: `export *` would also bundle
// setup functions such as initializeGT, which reach the parser through chain A.
describe('framework message API bundles', () => {
  it.each([
    ['gt-react (react-server)', 'gt-react-rsc.ts', ['react-server']],
    ['gt-node', 'gt-node.ts', ['node']],
  ])('%s does not include the ICU string parser', (_, fixture, conditions) =>
    expectParser(fixture, conditions, false)
  );

  // Known leak, a static chain into @generaltranslation/icu/parser:
  // A: I18nConfig extends GTIntl, whose formatMessage method calls formatIcu;
  //    class methods are never tree-shaken.
  // These assert the parser IS bundled, so a broken build still fails and a
  // fix flips them; once the chain is cut, move them to the list above.
  it.each([
    // A
    [
      '@generaltranslation/react-core/pure and /hooks',
      'react-core.ts',
      ['browser'],
    ],
    // A
    ['gt-react (client)', 'gt-react.ts', ['browser']],
    // A
    ['gt-next (client)', 'gt-next.ts', ['browser']],
    // A
    ['gt-next (ssr)', 'gt-next.ts', ['node']],
    // A
    ['gt-next (react-server)', 'gt-next.ts', ['react-server']],
    // A
    ['gt-next/server', 'gt-next-server.ts', ['react-server']],
    // A
    ['gt-react-native', 'gt-react-native.ts', ['react-native']],
    // A
    ['gt-tanstack-start (client)', 'gt-tanstack-start.ts', ['browser']],
    // A
    ['gt-tanstack-start (server)', 'gt-tanstack-start.ts', ['node']],
  ])('%s still includes the ICU string parser', (_, fixture, conditions) =>
    expectParser(fixture, conditions, true)
  );
});
