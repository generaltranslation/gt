import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUpdates } from '../parse.js';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import type { TranslateFlags } from '../../types/index.js';

vi.mock('../../react/parse/createInlineUpdates.js', () => ({
  createInlineUpdates: vi.fn(),
}));

vi.mock('../../python/parse/createPythonInlineUpdates.js', () => ({
  createPythonInlineUpdates: vi.fn(),
}));

describe('createUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not reject duplicate custom ids when entries have distinct hashes', async () => {
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [
        {
          dataFormat: 'ICU',
          source: 'Hello',
          metadata: { id: 'shared-id', hash: 'first-hash' },
        },
        {
          dataFormat: 'ICU',
          source: 'Goodbye',
          metadata: { id: 'shared-id', hash: 'second-hash' },
        },
      ],
      errors: [],
      warnings: [],
    });

    const result = await createUpdates(
      {} as TranslateFlags,
      [],
      undefined,
      Libraries.GT_REACT,
      false,
      {},
      {} as ParsingConfigOptions
    );

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(2);
    expect(result.updates.map((update) => update.metadata.hash)).toEqual([
      'first-hash',
      'second-hash',
    ]);
  });
});
