/**
 * <T> props written as plain string literals (context="...", id="...") must
 * reach metadata so hashing and registration see them, giving the same
 * context-ful hash the runtime and the compiler compute.
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
  test('context="..." reaches metadata.context and the hash', async () => {
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

  test('$context="..." is not read as the context', async () => {
    const result = await parseFixture('page.tsx');
    const prefixed = result.updates.find((u) =>
      JSON.stringify(u.source).includes('"Cover"')
    );
    expect(prefixed?.metadata.context).toBeUndefined();
    expect(prefixed?.metadata.hash).toEqual(
      hashSource({ source: prefixed!.source, dataFormat: prefixed!.dataFormat })
    );
  });

  test('id="..." reaches metadata.id', async () => {
    const result = await parseFixture('page.tsx');
    const withId = result.updates.find((u) =>
      JSON.stringify(u.source).includes('"Spine"')
    );
    expect(withId?.metadata.id).toEqual('book-id');
  });

  test('maxChars="10" (string-typed) is rejected like maxChars={"10"}', async () => {
    const result = await parseFixture('max-chars-string.tsx');
    expect(
      result.errors.some((e) => e.toLowerCase().includes('maxchars'))
    ).toBe(true);
  });
});
