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
import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { hashSource } from 'generaltranslation/id';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';

vi.mock('../jsx/utils/parseStringFunction.js', () => ({
  parseStrings: vi.fn(),
}));
vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const FIXTURES = path.join(__dirname, '__fixtures__/context-props');

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

async function parseFixture(file: string) {
  const { matchFiles } = await import('../../../fs/matchFiles.js');
  vi.mocked(matchFiles).mockReturnValue([path.join(FIXTURES, file)]);
  return createInlineUpdates(
    Libraries.GT_REACT,
    false,
    undefined,
    {},
    parsingOptions
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('T component prop hashing (string-literal props)', () => {
  test('$context="..." reaches metadata.context and the hash', async () => {
    const result = await parseFixture('page.tsx');
    expect(result.errors).toHaveLength(0);

    const bookUpdates = result.updates.filter((u) =>
      JSON.stringify(u.source).includes('"Book"')
    );
    // Two different contexts on identical children must NOT dedupe into one
    expect(bookUpdates).toHaveLength(2);

    const contexts = bookUpdates.map((u) => u.metadata.context).sort();
    expect(contexts).toEqual([
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
  });

  test('legacy context="..." keeps working', async () => {
    const result = await parseFixture('page.tsx');
    const legacy = result.updates.find((u) =>
      JSON.stringify(u.source).includes('"Cover"')
    );
    expect(legacy?.metadata.context).toEqual('legacy context prop');
  });

  test('$id="..." maps to metadata.id', async () => {
    const result = await parseFixture('page.tsx');
    const withId = result.updates.find((u) =>
      JSON.stringify(u.source).includes('"Spine"')
    );
    expect(withId?.metadata.id).toEqual('book-id');
    expect(withId?.metadata).not.toHaveProperty('$id');
  });

  test('$maxChars="10" (string-typed) is rejected like maxChars={"10"}', async () => {
    const result = await parseFixture('max-chars-string.tsx');
    expect(
      result.errors.some((e) => e.toLowerCase().includes('maxchars'))
    ).toBe(true);
  });
});
