import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, TranslateFlags } from '../../../types/index.js';
import { Libraries } from '../../../types/libraries.js';
import { TEMPLATE_FILE_ID } from '../../../utils/constants.js';

vi.mock('../../../translation/stage.js', () => ({
  aggregateInlineTranslations: vi.fn(),
}));

import { aggregateInlineTranslations } from '../../../translation/stage.js';
import { collectFiles } from '../collectFiles.js';

const initialCwd = process.cwd();
const temporaryDirectories: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aggregateInlineTranslations).mockResolvedValue([
    {
      dataFormat: 'STRING',
      source: 'Vue message',
      metadata: { hash: 'vue-hash' },
    },
  ]);
});

afterEach(() => {
  process.chdir(initialCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('collectFiles Vue adapter', () => {
  it.each([
    ['next-intl', 'ICU'],
    ['i18next', 'I18NEXT'],
  ] as const)(
    'keeps %s JSON semantics while collecting direct gt-vue content',
    async (fileLibrary, expectedDataFormat) => {
      const root = createFixture(fileLibrary);
      const sourcePath = path.join(root, 'messages.json');
      const settings = createSettings(sourcePath);
      const options = {} as TranslateFlags;
      process.chdir(root);

      const result = await collectFiles(options, settings, fileLibrary);

      const sourceFile = result.files.find(
        ({ fileFormat }) => fileFormat === 'JSON'
      );
      expect(sourceFile?.dataFormat).toBe(expectedDataFormat);
      expect(
        result.files.some(({ fileId }) => fileId === TEMPLATE_FILE_ID)
      ).toBe(true);
      expect(result.reactComponents).toBe(1);
      expect(aggregateInlineTranslations).toHaveBeenCalledOnce();
      expect(aggregateInlineTranslations).toHaveBeenCalledWith(
        options,
        settings,
        Libraries.GT_VUE
      );
    }
  );
});

function createFixture(fileLibrary: 'next-intl' | 'i18next'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cli-vue-files-'));
  temporaryDirectories.push(root);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      dependencies: { [fileLibrary]: '*', 'gt-vue': '*' },
    })
  );
  fs.writeFileSync(
    path.join(root, 'messages.json'),
    JSON.stringify({ greeting: 'Hello' })
  );
  return root;
}

function createSettings(sourcePath: string): Settings {
  return {
    defaultLocale: 'en',
    locales: ['fr'],
    publish: true,
    options: {},
    files: {
      resolvedPaths: { json: [sourcePath] },
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set<string>(),
      unpublishPaths: new Set<string>(),
      requiresReviewPaths: new Set<string>(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} },
    },
  } as Settings;
}
