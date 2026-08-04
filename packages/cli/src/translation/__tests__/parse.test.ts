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

  it('rejects derived <T> entries when one explicit id has distinct hashes', async () => {
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [
        {
          dataFormat: 'ICU',
          source: 'Hello',
          metadata: {
            id: 'landing',
            hash: 'first-hash',
            staticId: 'derive-id',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'Goodbye',
          metadata: {
            id: 'landing',
            hash: 'second-hash',
            staticId: 'derive-id',
          },
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

    expect(result.errors).toEqual([
      'Explicit id landing cannot map to multiple source messages or hashes because one explicit id must map to exactly one source message and hash. Remove or rename duplicated IDs, or ensure every <T> component and dictionary entry using this id has matching content.',
    ]);
    expect(result.updates).toEqual([]);
  });

  it('allows duplicate custom ids when entries have matching hashes', async () => {
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [
        {
          dataFormat: 'ICU',
          source: 'Hello',
          metadata: { id: 'shared-id', hash: 'same-hash' },
        },
        {
          dataFormat: 'ICU',
          source: 'Hello',
          metadata: { id: 'shared-id', hash: 'same-hash' },
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
    expect(result.updates.map((update) => update.metadata.id)).toEqual([
      'shared-id',
      'shared-id',
    ]);
  });
});
