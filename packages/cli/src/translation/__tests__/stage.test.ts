import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateInlineTranslations } from '../stage.js';
import findFilepath from '../../fs/findFilepath.js';
import { createUpdates } from '../parse.js';
import type { Settings, TranslateFlags } from '../../types/index.js';
import type { InlineLibrary } from '../../types/libraries.js';

vi.mock('../../fs/findFilepath.js', () => ({
  default: vi.fn(() => './auto-detected/dictionary.json'),
}));

vi.mock('../parse.js', () => ({
  createUpdates: vi.fn(async () => ({ updates: [], errors: [], warnings: [] })),
}));

vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const makeSettings = (dictionary?: string): Settings =>
  ({
    dictionary,
    src: undefined,
    files: { gtJson: { parsingFlags: {} } },
    parsingOptions: {},
  }) as unknown as Settings;

const library = 'gt-next' as InlineLibrary;

describe('aggregateInlineTranslations dictionary resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the --dictionary flag over gt.config.json', async () => {
    const options = { dictionary: './flag/dictionary.json' } as TranslateFlags;
    await aggregateInlineTranslations(
      options,
      makeSettings('./config/messages.json'),
      library
    );
    expect(createUpdates).toHaveBeenCalledWith(
      options,
      undefined,
      './flag/dictionary.json',
      library,
      false,
      {},
      {}
    );
    expect(findFilepath).not.toHaveBeenCalled();
  });

  it('falls back to the gt.config.json dictionary when the flag is absent', async () => {
    const options = {} as TranslateFlags;
    await aggregateInlineTranslations(
      options,
      makeSettings('./messages/en.json'),
      library
    );
    expect(createUpdates).toHaveBeenCalledWith(
      options,
      undefined,
      './messages/en.json',
      library,
      false,
      {},
      {}
    );
    expect(findFilepath).not.toHaveBeenCalled();
  });

  it('auto-detects when neither flag nor config sets a dictionary', async () => {
    const options = {} as TranslateFlags;
    await aggregateInlineTranslations(options, makeSettings(), library);
    expect(findFilepath).toHaveBeenCalledOnce();
    expect(createUpdates).toHaveBeenCalledWith(
      options,
      undefined,
      './auto-detected/dictionary.json',
      library,
      false,
      {},
      {}
    );
  });
});
