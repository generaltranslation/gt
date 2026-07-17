import { Command } from 'commander';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InlineCLI } from '../inline.js';
import { Libraries } from '../../types/libraries.js';
import type { TranslateFlags } from '../../types/index.js';
import { generateSettings } from '../../config/generateSettings.js';
import { aggregateInlineTranslations } from '../../translation/stage.js';
import { saveJSON } from '../../fs/saveJSON.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));
vi.mock('../../translation/stage.js', () => ({
  aggregateInlineTranslations: vi.fn(),
}));
vi.mock('../../fs/saveJSON.js', () => ({
  saveJSON: vi.fn(),
}));
vi.mock('../../fs/loadJSON.js', () => ({
  default: vi.fn(() => ({})),
}));
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exitSync(${code})`);
  }),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    endCommand: vi.fn(),
  },
}));

class TestCLI extends InlineCLI {
  public runGenerate(options: TranslateFlags): Promise<void> {
    return this.handleGenerateSourceCommand(options);
  }
}

function makeSettings(locales: string[]) {
  return {
    defaultLocale: 'en',
    locales,
    customMapping: undefined,
    files: {
      placeholderPaths: { gt: '/project/_gt/[locale].json' },
    },
  };
}

function makeUpdates() {
  return [
    { dataFormat: 'ICU', source: 'Hello, {name}', metadata: { hash: 'h1' } },
  ];
}

const flags = { timeout: 0, dryRun: false } as TranslateFlags;

describe('gt generate --pseudo wiring', () => {
  let cli: TestCLI;

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new TestCLI(new Command(), Libraries.GT_REACT);
    vi.mocked(generateSettings).mockResolvedValue(
      makeSettings(['fr']) as never
    );
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      makeUpdates() as never
    );
  });

  it('writes a fully pseudo-localized file for the default pseudo locale', async () => {
    await cli.runGenerate({ ...flags, pseudo: true });

    const pseudoWrite = vi
      .mocked(saveJSON)
      .mock.calls.find(([path]) => path === '/project/_gt/en-XA.json');
    expect(pseudoWrite).toBeDefined();
    expect(pseudoWrite![1]).toEqual({ h1: '[Ĥéļļö, {name} ~~]' });
  });

  it('skips configured pseudo-locales in the merge loop but still regenerates them', async () => {
    vi.mocked(generateSettings).mockResolvedValue(
      makeSettings(['fr', 'en-XA']) as never
    );

    await cli.runGenerate({ ...flags, pseudo: true });

    const pseudoWrites = vi
      .mocked(saveJSON)
      .mock.calls.filter(([path]) => path === '/project/_gt/en-XA.json');
    expect(pseudoWrites).toHaveLength(1);
    expect(pseudoWrites[0][1]).toEqual({ h1: '[Ĥéļļö, {name} ~~]' });
  });

  it('does not pollute a configured pseudo-locale on a plain generate', async () => {
    vi.mocked(generateSettings).mockResolvedValue(
      makeSettings(['fr', 'en-XA']) as never
    );

    await cli.runGenerate(flags);

    const pseudoWrites = vi
      .mocked(saveJSON)
      .mock.calls.filter(([path]) => path === '/project/_gt/en-XA.json');
    expect(pseudoWrites).toHaveLength(0);
    const frWrites = vi
      .mocked(saveJSON)
      .mock.calls.filter(([path]) => path === '/project/_gt/fr.json');
    expect(frWrites).toHaveLength(1);
  });

  it('refuses to overwrite a configured real locale and writes nothing', async () => {
    await expect(cli.runGenerate({ ...flags, pseudo: 'fr' })).rejects.toThrow(
      'exitSync(1)'
    );
    expect(vi.mocked(saveJSON)).not.toHaveBeenCalled();
  });
});
