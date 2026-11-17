import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';
import {
  clearEmbeddedHashes,
  getEmbeddedHashes,
  recordLoadedHashes,
} from '../../../state/embeddedHashes.js';

vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const FIXTURE = path.join(__dirname, '__fixtures__/embedded-hashes/page.tsx');
const HELPER_FIXTURE = path.join(
  __dirname,
  '__fixtures__/embedded-hashes-helper/page.tsx'
);

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

const treeHash = (source: string | unknown[], context?: string) =>
  hashSource({
    source: source as string,
    context,
    dataFormat: 'MESSAGE_TREE',
  });

async function extract(file: string) {
  const { matchFiles } = await import('../../../fs/matchFiles.js');
  vi.mocked(matchFiles).mockReturnValue([file]);
  const result = await createInlineUpdates(
    Libraries.GT_NEXT,
    false,
    undefined,
    {},
    parsingOptions
  );
  expect(result.errors).toHaveLength(0);
  return result;
}

beforeEach(() => {
  clearEmbeddedHashes();
});

describe('embedded hashes', () => {
  test('records <T> and unstable gt messages the compiler embeds', async () => {
    const { updates } = await extract(FIXTURE);
    const jsxHash = updates.find((update) => update.dataFormat === 'JSX')
      ?.metadata.hash;
    expect(jsxHash).toBeDefined();

    expect([...(getEmbeddedHashes() ?? [])].sort()).toEqual(
      [
        jsxHash,
        treeHash('Embedded string'),
        treeHash(['Hello, ', ['name'], '!'], 'greeting'),
      ].sort()
    );
  });

  test('leaves out entries that still load', async () => {
    const { updates } = await extract(FIXTURE);
    const embedded = getEmbeddedHashes();
    const loaded = updates
      .filter((update) => !embedded?.has(update.metadata.hash!))
      .map((update) => update.source);
    expect(loaded).toEqual(
      expect.arrayContaining([
        // msg(), a stable gt(), a configured tag, an anonymous value, a
        // __proto__ variable, a message an alias also uses, a closure that
        // precedes its gt declaration, a let gt, and a use before its import
        'Registered message',
        'Legacy string',
        'Save',
        ['You have ', ['_gt_1'], ' items'],
        // the compilers leave __proto__ keys to the runtime
        ['Proto ', ['__proto__']],
        'Shared text',
        'Earlier closure',
        'Let binding',
        'Before its import',
      ])
    );
  });

  test('keeps hashes that another extractor also loads', async () => {
    const { updates } = await extract(FIXTURE);
    const jsx = updates.find((update) => update.dataFormat === 'JSX')!;
    // gt-vue's merge replaces an update that shares its hash with a new object
    recordLoadedHashes([...updates, { ...jsx, metadata: { ...jsx.metadata } }]);
    expect([...(getEmbeddedHashes() ?? [])].sort()).toEqual(
      [
        treeHash('Embedded string'),
        treeHash(['Hello, ', ['name'], '!'], 'greeting'),
      ].sort()
    );
  });

  test('does not embed stable gt() or m() through a helper', async () => {
    await extract(HELPER_FIXTURE);
    expect([...(getEmbeddedHashes() ?? [])]).toEqual([]);
  });

  test('stays undefined when the scan finds no inline content', async () => {
    const { matchFiles } = await import('../../../fs/matchFiles.js');
    vi.mocked(matchFiles).mockReturnValue([]);

    await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      undefined,
      {},
      parsingOptions
    );
    expect(getEmbeddedHashes()).toBeUndefined();
  });

  test('is undefined until something is extracted', () => {
    recordLoadedHashes([
      { dataFormat: 'ICU', source: 'Vue only', metadata: { hash: 'vue' } },
    ]);
    expect(getEmbeddedHashes()).toBeUndefined();
  });
});
