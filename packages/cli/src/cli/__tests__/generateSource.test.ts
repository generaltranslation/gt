import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Updates } from 'generaltranslation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));
vi.mock('../../translation/stage.js', () => ({
  aggregateInlineTranslations: vi.fn(),
}));
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  setBannerAnimation: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));
vi.mock('../../console/logger.js', () => ({
  logger: new Proxy({}, { get: () => () => {} }),
}));

import { generateSettings } from '../../config/generateSettings.js';
import { aggregateInlineTranslations } from '../../translation/stage.js';
import { InlineCLI } from '../inline.js';

const updates: Updates = [
  {
    dataFormat: 'JSX',
    source: 'Welcome back',
    metadata: {
      hash: 'welcome-hash',
      id: 'home.welcome',
      context: 'greeting on the home page',
      maxChars: 20,
      filePaths: ['src/b.tsx', 'src/a.tsx'],
      sourceCode: { 'src/a.tsx': [] },
    },
  },
  {
    dataFormat: 'ICU',
    source: 'Save',
    metadata: { hash: 'save-hash', requiresReview: true },
  },
  {
    dataFormat: 'ICU',
    source: 'Cancel',
    metadata: { hash: 'cancel-hash', id: 'nav.cancel', requiresReview: false },
  },
  {
    dataFormat: 'ICU',
    source: 'Cancel',
    metadata: {
      hash: 'cancel-hash',
      id: 'modal.cancel',
      filePaths: ['src/modal.tsx'],
    },
  },
  { dataFormat: 'ICU', source: 'No hash', metadata: {} },
];

describe('gt generate', () => {
  let projectRoot: string;
  const sourceCatalog = {
    'welcome-hash': 'Welcome back',
    'save-hash': 'Save',
    'cancel-hash': 'Cancel',
  };
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8'));
  const run = (...args: string[]) => {
    const program = new Command().exitOverride();
    new InlineCLI(program, 'gt-react').init();
    return program.parseAsync(['generate', ...args], { from: 'user' });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectRoot = fs.mkdtempSync(path.join(tmpdir(), 'gt-generate-'));
    fs.mkdirSync(path.join(projectRoot, 'translations'));
    fs.writeFileSync(
      path.join(projectRoot, 'translations/fr.json'),
      JSON.stringify({ 'welcome-hash': 'Bon retour', stale: 'Ancien' })
    );
    vi.mocked(generateSettings).mockResolvedValue({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      files: {
        placeholderPaths: {
          gt: path.join(projectRoot, 'translations/[locale].json'),
        },
      },
    } as unknown as Settings);
    vi.mocked(aggregateInlineTranslations).mockResolvedValue(
      structuredClone(updates)
    );
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('fills target locale files with source entries by default', async () => {
    await run();

    expect(read('translations/en.json')).toEqual(sourceCatalog);
    expect(read('translations/fr.json')).toEqual({
      ...sourceCatalog,
      'welcome-hash': 'Bon retour',
    });
  });

  it('leaves target locale files unchanged with --source-only', async () => {
    const target = fs.readFileSync(
      path.join(projectRoot, 'translations/fr.json'),
      'utf8'
    );

    await run('--source-only');

    expect(read('translations/en.json')).toEqual(sourceCatalog);
    expect(
      fs.readFileSync(path.join(projectRoot, 'translations/fr.json'), 'utf8')
    ).toBe(target);
  });

  it('writes entry metadata keyed by source hash with --metadata', async () => {
    const metadataPath = path.join(projectRoot, 'out/metadata.json');

    await run('--source-only', '--metadata', metadataPath);

    expect(read('out/metadata.json')).toEqual({
      'welcome-hash': {
        dataFormat: 'JSX',
        id: 'home.welcome',
        context: 'greeting on the home page',
        maxChars: 20,
        filePaths: ['src/a.tsx', 'src/b.tsx'],
      },
      'save-hash': { dataFormat: 'ICU', requiresReview: true },
      'cancel-hash': {
        dataFormat: 'ICU',
        id: 'nav.cancel',
        requiresReview: false,
        filePaths: ['src/modal.tsx'],
      },
    });
    expect(Object.keys(read('out/metadata.json'))).toEqual(
      Object.keys(read('translations/en.json'))
    );
  });

  it.each(['translations/fr.json', 'translations/en.json'])(
    'rejects a --metadata path that is the locale file %s before writing',
    async (catalog) => {
      const catalogPath = path.join(projectRoot, catalog);
      fs.writeFileSync(catalogPath, '{"kept":"as is"}');
      const cwd = vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

      await expect(run('--source-only', '--metadata', catalog)).rejects.toThrow(
        '--metadata path is also a locale file'
      );
      cwd.mockRestore();

      expect(fs.readFileSync(catalogPath, 'utf8')).toBe('{"kept":"as is"}');
      expect(aggregateInlineTranslations).not.toHaveBeenCalled();
    }
  );

  it.each([['--source-only'], ['--metadata', 'out/metadata.json']])(
    'fails %s when files.gt.output is not set',
    async (...args) => {
      vi.mocked(generateSettings).mockResolvedValue({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        files: { placeholderPaths: {} },
      } as unknown as Settings);

      await expect(run(...args)).rejects.toThrow('files.gt.output');
      expect(aggregateInlineTranslations).not.toHaveBeenCalled();
    }
  );
});
