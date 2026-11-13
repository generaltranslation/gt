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
    ['gt-react/unstable (react-server)', 'gt-react.ts', ['react-server']],
    ['gt-node/unstable', 'gt-node.ts', ['node']],
  ])('%s does not include the ICU string parser', (_, fixture, conditions) =>
    expectParser(fixture, conditions, false)
  );

  // Known leaks, both static chains into @generaltranslation/icu/parser:
  // A: I18nConfig extends LocaleConfig, whose formatMessage method calls
  //    formatIcu; class methods are never tree-shaken.
  // B: gt-i18n hashMessage -> generaltranslation/internal indexVars ->
  //    traverseIcu -> parse, via getTranslateListenerKey (react-core tracked
  //    resolver) or TranslationsCache.getCacheKey.
  // These assert the parser IS bundled, so a broken build still fails and a
  // fix flips them; once both chains are cut, move them to the list above.
  it.each([
    // A + B
    ['@generaltranslation/react-core/unstable', 'react-core.ts', ['browser']],
    // A + B
    ['gt-react/unstable (client)', 'gt-react.ts', ['browser']],
    // A + B
    ['gt-next/unstable (client)', 'gt-next.ts', ['browser']],
    // A + B
    ['gt-next/unstable (ssr)', 'gt-next.ts', ['node']],
    // A + B
    ['gt-next/unstable (react-server)', 'gt-next.ts', ['react-server']],
    // A + B
    ['gt-next/unstable/server', 'gt-next-server.ts', ['react-server']],
    // A + B
    ['gt-react-native/unstable', 'gt-react-native.ts', ['react-native']],
    // A + B
    [
      'gt-tanstack-start/unstable (client)',
      'gt-tanstack-start.ts',
      ['browser'],
    ],
    // A + B
    ['gt-tanstack-start/unstable (server)', 'gt-tanstack-start.ts', ['node']],
  ])('%s still includes the ICU string parser', (_, fixture, conditions) =>
    expectParser(fixture, conditions, true)
  );
});
