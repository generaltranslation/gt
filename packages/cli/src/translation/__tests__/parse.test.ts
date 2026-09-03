import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUpdates } from '../parse.js';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { createPythonInlineUpdates } from '../../python/parse/createPythonInlineUpdates.js';
import { Libraries } from '../../types/libraries.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../types/parsing.js';
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

  it('rejects duplicate custom ids when entries have distinct hashes', async () => {
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

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('same id');
    expect(result.errors[0]).toContain('shared-id');
    expect(result.updates).toEqual([]);
  });

  it('allows derive variants (staticId) to share an id with distinct hashes', async () => {
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [
        {
          dataFormat: 'JSX',
          source: ['Hello', { t: 'Derive', i: 1, c: 'boy' }],
          metadata: {
            id: 'landing',
            hash: 'first-hash',
            staticId: 'shared-derive-id',
          },
        },
        {
          dataFormat: 'JSX',
          source: ['Hello', { t: 'Derive', i: 1, c: 'girl' }],
          metadata: {
            id: 'landing',
            hash: 'second-hash',
            staticId: 'shared-derive-id',
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

    expect(result.errors).toEqual([]);
    expect(result.updates).toHaveLength(2);
    expect(result.updates.map((update) => update.metadata.id)).toEqual([
      'landing',
      'landing',
    ]);
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

  it.each([
    Libraries.GT_REACT,
    Libraries.GT_NEXT,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_NODE,
  ])('preserves the historical %s extractor arguments', async (library) => {
    const patterns = ['src/entry.tsx'];
    const parsingFlags = {
      includeSourceCodeContext: true,
      legacyGtReactImportSource: 'custom-gt-react',
    } as GTParsingFlags;
    const parsingOptions = {
      conditionNames: ['source', 'import'],
    } as ParsingConfigOptions;
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });

    await createUpdates(
      {} as TranslateFlags,
      patterns,
      undefined,
      library,
      true,
      parsingFlags,
      parsingOptions
    );

    expect(createInlineUpdates).toHaveBeenCalledOnce();
    expect(createInlineUpdates).toHaveBeenCalledWith(
      library,
      true,
      patterns,
      parsingFlags,
      parsingOptions
    );
    expect(createPythonInlineUpdates).not.toHaveBeenCalled();
  });

  it.each([Libraries.GT_FLASK, Libraries.GT_FASTAPI])(
    'preserves the historical %s extractor arguments',
    async (library) => {
      const patterns = ['src/**/*.py'];
      vi.mocked(createPythonInlineUpdates).mockResolvedValue({
        updates: [],
        errors: [],
        warnings: [],
      });

      await createUpdates(
        {} as TranslateFlags,
        patterns,
        undefined,
        library,
        true,
        {},
        {} as ParsingConfigOptions
      );

      expect(createPythonInlineUpdates).toHaveBeenCalledOnce();
      expect(createPythonInlineUpdates).toHaveBeenCalledWith(patterns);
      expect(createInlineUpdates).not.toHaveBeenCalled();
    }
  );
});
