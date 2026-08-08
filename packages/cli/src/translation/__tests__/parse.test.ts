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

vi.mock('@generaltranslation/vue-extractor/integration', () => ({
  planVueExtraction: vi.fn(() => ({ handled: false })),
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

  it('keeps the historical React callback arguments unchanged', async () => {
    const patterns = ['src/App.tsx', '!src/generated/**'];
    const flags = {
      autoderive: false,
      includeSourceCodeContext: false,
      enableAutoJsxInjection: false,
      legacyGtReactImportSource: false,
    } satisfies GTParsingFlags;
    const parsingOptions = {
      conditionNames: ['browser', 'import'],
    } satisfies ParsingConfigOptions;
    vi.mocked(createInlineUpdates).mockResolvedValue({
      updates: [],
      errors: [],
      warnings: [],
    });

    await createUpdates(
      {} as TranslateFlags,
      patterns,
      undefined,
      Libraries.GT_REACT,
      true,
      flags,
      parsingOptions
    );

    expect(createInlineUpdates).toHaveBeenCalledOnce();
    expect(createInlineUpdates).toHaveBeenCalledWith(
      Libraries.GT_REACT,
      true,
      patterns,
      flags,
      parsingOptions
    );
    expect(vi.mocked(createInlineUpdates).mock.calls[0][2]).toBe(patterns);
  });

  it('keeps Python extraction on its historical callback', async () => {
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
      Libraries.GT_FASTAPI,
      false,
      {} as GTParsingFlags,
      {} as ParsingConfigOptions
    );

    expect(createPythonInlineUpdates).toHaveBeenCalledOnce();
    expect(vi.mocked(createPythonInlineUpdates).mock.calls[0][0]).toBe(
      patterns
    );
    expect(createInlineUpdates).not.toHaveBeenCalled();
  });
});
