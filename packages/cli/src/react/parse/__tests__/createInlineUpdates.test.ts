import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, vi } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { matchFiles } from '../../../fs/matchFiles.js';
import { hashSource } from 'generaltranslation/id';
import type {
  GTParsingFlags,
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
    {} as GTParsingFlags,
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
   * <T> props written as plain string literals ($context="...", $id="...")
   * must be name-mapped into metadata so hashing and registration see them.
   *
   * Previously only the expression-container path ($context={"..."}) applied
   * mapAttributeName; the string-literal path stored metadata.$context, which
   * calculateHashes (reads metadata.context) never saw. Every
   * <T $context="..."> was therefore registered under a context-LESS hash,
   * while the runtime and the compiler both compute context-FUL hashes — so
   * translation lookups for context-carrying <T> components always missed.
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

      // The unprefixed form keeps working
      expect(updatesWith('"Cover"').map((u) => u.metadata.context)).toEqual([
        'an unprefixed context prop',
      ]);

      // $id="..." maps to metadata.id
      const [withId] = updatesWith('"Spine"');
      expect(withId.metadata.id).toEqual('book-id');
      expect(withId.metadata).not.toHaveProperty('$id');
    });

    test('$maxChars="10" (string-typed) is rejected like maxChars={"10"}', async () => {
      const result = await scanFixtures('max-chars-string.tsx');

      expect(
        result.errors.some((e) => e.toLowerCase().includes('maxchars'))
      ).toBe(true);
    });
  });

  /**
   * The CLI scan emits ONE consolidated warning (never an error) listing
   * every occurrence of deprecated $-prefixed sugar props on <T> components
   * as file:line:column, covering both the string-literal ($context="...")
   * and expression-container ($context={"..."}) forms.
   */
  describe('deprecated $-prefixed prop warning', () => {
    /**
     * Expected file:line:column for each occurrence of an attribute in a
     * fixture. Bare boolean attributes (`<T $requiresReview>`) carry no `=`,
     * so they are matched on the closing bracket instead.
     */
    function expectedLocations(file: string, attr: string, bare = false) {
      const fullPath = path.join(FIXTURES, file);
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      return lines.flatMap((line, index) => {
        const column = line.indexOf(bare ? `${attr}>` : `${attr}=`);
        return column === -1
          ? []
          : [`${fullPath}:${index + 1}:${column} (${attr})`];
      });
    }

    test('one consolidated warning lists all occurrences across files and forms', async () => {
      const result = await scanFixtures('page.tsx', 'expression-container.tsx');

      expect(result.errors).toEqual([]);
      // Fires exactly once, no matter how many occurrences
      const deprecations = result.warnings.filter((w) =>
        w.includes('deprecated')
      );
      expect(deprecations).toHaveLength(1);
      const [warning] = deprecations;

      // String-literal forms: two $context and one $id in page.tsx
      // Expression-container forms: $context={...}, $maxChars={...}, and
      // $requiresReview in both the bare and ={true} forms
      const expected = [
        ...expectedLocations('page.tsx', '$context'),
        ...expectedLocations('page.tsx', '$id'),
        ...expectedLocations('expression-container.tsx', '$context'),
        ...expectedLocations('expression-container.tsx', '$maxChars'),
        ...expectedLocations('expression-container.tsx', '$requiresReview'),
        ...expectedLocations(
          'expression-container.tsx',
          '$requiresReview',
          true
        ),
      ];
      expect(expected).toHaveLength(7);
      for (const location of expected) {
        expect(warning).toContain(location);
      }
      // Advises the unprefixed forms and the removal horizon
      expect(warning).toContain('unprefixed');
      expect(warning).toContain('next major version');
    });

    test('no deprecation warning when only unprefixed props are used', async () => {
      const result = await scanFixtures('unprefixed.tsx');

      expect(result.errors).toEqual([]);
      expect(result.warnings.filter((w) => w.includes('deprecated'))).toEqual(
        []
      );
    });
  });
});
