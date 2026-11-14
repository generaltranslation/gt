import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, vi } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { matchFiles } from '../../../fs/matchFiles.js';
import { hashSource } from 'generaltranslation/id';
import type {
  ResolvedGTParsingFlags,
  ParsingConfigOptions,
} from '../../../types/parsing.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';

vi.mock('../../../fs/matchFiles.js', () => ({ matchFiles: vi.fn() }));

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

/** Runs createInlineUpdates over the given files. */
function scan(pkg: GTLibrary, files: string[]) {
  vi.mocked(matchFiles).mockReturnValue(files);
  return createInlineUpdates(
    pkg,
    false,
    undefined,
    {} as ResolvedGTParsingFlags,
    parsingOptions
  );
}

// The seeds are shared with the compiler, vue and vue-extractor packages
describe('createInlineUpdates on tests/seeds', () => {
  const SEEDS = path.join(__dirname, '../../../../../../tests/seeds');
  // These seeds have errors (they contain {undefined}, which is disallowed)
  const SEEDS_WITH_ERRORS = [
    'complex-cases/many-edge-cases',
    'complex-cases/more-extreme-edge-cases',
    'complex-cases/whitespace',
    't-component/simple/expressions/static-special-identifiers',
  ];

  /** Directories below `dir` that hold a page.tsx and its expected.json. */
  function seedDirs(dir: string): string[] {
    if (
      fs.existsSync(path.join(dir, 'expected.json')) &&
      fs.existsSync(path.join(dir, 'page.tsx'))
    ) {
      return [path.relative(SEEDS, dir)];
    }
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => seedDirs(path.join(dir, entry.name)));
  }

  const seeds = seedDirs(SEEDS).filter(
    (seed) => !SEEDS_WITH_ERRORS.includes(seed.split(path.sep).join('/'))
  );

  test.each(seeds)('%s', async (seed) => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(SEEDS, seed, 'expected.json'), 'utf8')
    );

    const result = await scan(Libraries.GT_NEXT, [
      path.join(SEEDS, seed, 'page.tsx'),
    ]);

    // A seed without updates must explain why
    if (result.updates.length === 0) {
      expect(result.warnings.length || result.errors.length).toBeGreaterThan(0);
      return;
    }
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);

    for (const update of result.updates) {
      if (!update.metadata.hash || !update.source) continue;
      if (expected.static) {
        expect(expected.content).toHaveProperty(update.metadata.hash);
        continue;
      }
      const { context, maxChars } = update.metadata;
      expect(update.metadata.hash).toEqual(
        hashSource({
          source: update.source,
          ...(context && { context }),
          ...(maxChars && { maxChars }),
          dataFormat: update.dataFormat,
        })
      );
    }
  });
});

describe('<T> props', () => {
  const FIXTURES = path.join(__dirname, '__fixtures__/context-props');
  const scanFixtures = (...files: string[]) =>
    scan(
      Libraries.GT_REACT,
      files.map((file) => path.join(FIXTURES, file))
    );

  /**
   * <T> props written as plain string literals (context="...", id="...") must
   * reach metadata so hashing and registration see them, giving the same
   * context-ful hash the runtime and the compiler compute.
   */
  describe('string-literal props', () => {
    test('reach the metadata and the hash', async () => {
      const result = await scanFixtures('page.tsx');
      const updatesWith = (text: string) =>
        result.updates.filter((u) => JSON.stringify(u.source).includes(text));

      expect(result.errors).toEqual([]);

      // Two different contexts on identical children must NOT dedupe into one
      const bookUpdates = updatesWith('"Book"');
      expect(bookUpdates.map((u) => u.metadata.context).sort()).toEqual([
        'A call-to-action that reserves a hotel stay',
        'A noun meaning a printed publication',
      ]);
      // Hashes must be the context-ful hashes the runtime computes at lookup
      for (const update of bookUpdates) {
        expect(update.metadata.hash).toEqual(
          hashSource({
            source: update.source,
            context: update.metadata.context as string,
            dataFormat: update.dataFormat,
          })
        );
      }

      // $context="..." is not read as the context
      const [prefixed] = updatesWith('"Cover"');
      expect(prefixed.metadata.context).toBeUndefined();
      expect(prefixed.metadata.hash).toEqual(
        hashSource({ source: prefixed.source, dataFormat: prefixed.dataFormat })
      );

      const [withId] = updatesWith('"Spine"');
      expect(withId.metadata.id).toEqual('book-id');
    });

    test('maxChars="10" (string-typed) is rejected like maxChars={"10"}', async () => {
      const result = await scanFixtures('max-chars-string.tsx');

      expect(
        result.errors.some((e) => e.toLowerCase().includes('maxchars'))
      ).toBe(true);
    });
  });
});
