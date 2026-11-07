import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';
import {
  clearMessageHashes,
  getMessageHashes,
} from '../../../state/messageHashes.js';

vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const FIXTURE = path.join(__dirname, '__fixtures__/message-hashes/page.tsx');
const HELPER_FIXTURE = path.join(
  __dirname,
  '__fixtures__/message-hashes-helper/page.tsx'
);

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

const icuHash = (source: string) => hashSource({ source, dataFormat: 'ICU' });

beforeEach(() => {
  clearMessageHashes();
});

describe('message hashes', () => {
  test('records entries from msg() and m(), not gt()', async () => {
    const { matchFiles } = await import('../../../fs/matchFiles.js');
    vi.mocked(matchFiles).mockReturnValue([FIXTURE]);

    const result = await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      undefined,
      {},
      parsingOptions
    );
    expect(result.errors).toHaveLength(0);

    expect([...(getMessageHashes() ?? [])].sort()).toEqual(
      [
        icuHash('Registered greeting'),
        icuHash('Literal message'),
        // Also passed to gt() first, so dedupe keeps the gt() update
        icuHash('Shared text'),
      ].sort()
    );
    expect(getMessageHashes()?.has(icuHash('Inline string'))).toBe(false);
  });

  test('records a helper called with m() after gt()', async () => {
    const { matchFiles } = await import('../../../fs/matchFiles.js');
    vi.mocked(matchFiles).mockReturnValue([HELPER_FIXTURE]);

    const result = await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      undefined,
      {},
      parsingOptions
    );
    expect(result.errors).toHaveLength(0);
    expect([...(getMessageHashes() ?? [])]).toEqual([icuHash('Helper text')]);
  });

  test('is undefined until something is extracted', () => {
    expect(getMessageHashes()).toBeUndefined();
  });
});
