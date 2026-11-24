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
      sourceCode: {
        'src/modal.tsx': [{ before: '', target: 'Cancel', after: '' }],
      },
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
        sourceCode: { 'src/a.tsx': [] },
      },
      'save-hash': { dataFormat: 'ICU', requiresReview: true },
      'cancel-hash': {
        dataFormat: 'ICU',
        id: 'nav.cancel',
        requiresReview: false,
        filePaths: ['src/modal.tsx'],
        sourceCode: {
          'src/modal.tsx': [{ before: '', target: 'Cancel', after: '' }],
        },
      },
    });
    expect(Object.keys(read('out/metadata.json'))).toEqual(
      Object.keys(read('translations/en.json'))
    );
  });

  it('writes metadata next to the source file when --metadata has no path', async () => {
    await run('--source-only', '--metadata');

    expect(Object.keys(read('translations/en.metadata.json'))).toEqual(
      Object.keys(sourceCatalog)
    );
  });

  describe('rejects a --metadata path that is a locale file', () => {
    const originalCwd = process.cwd();
    beforeEach(() => process.chdir(projectRoot));
    afterEach(() => process.chdir(originalCwd));
    const link = (target: string, alias: string) =>
      fs.symlinkSync(path.resolve(target), path.resolve(alias), 'junction');
    const french = '{"welcome-hash":"Bon retour","stale":"Ancien"}';
    const expectRejectedBeforeWriting = async (...args: string[]) => {
      await expect(run(...args)).rejects.toThrow(
        '--metadata path is also a locale file'
      );
      expect(aggregateInlineTranslations).not.toHaveBeenCalled();
      expect(fs.existsSync('translations/en.json')).toBe(false);
    };

    it.each([
      ['the target file', 'translations/fr.json', () => {}],
      ['the source file', 'translations/en.json', () => {}],
      [
        'a target reached through a symlinked directory',
        'linked/fr.json',
        () => link('translations', 'linked'),
      ],
      [
        'a target reached through .. after a missing directory',
        'translations/scratch/../fr.json',
        () => {},
      ],
      [
        'a hard link to the target',
        'hard.json',
        () => fs.linkSync('translations/fr.json', 'hard.json'),
      ],
    ])('%s', async (_name, metadataPath, setup) => {
      fs.writeFileSync('translations/fr.json', french);
      setup();

      await expectRejectedBeforeWriting(
        '--source-only',
        '--metadata',
        metadataPath
      );

      expect(fs.readFileSync('translations/fr.json', 'utf8')).toBe(french);
    });

    it('the target file when target files are merged', async () => {
      fs.writeFileSync('translations/fr.json', french);

      await expectRejectedBeforeWriting('--metadata', 'translations/fr.json');

      expect(fs.readFileSync('translations/fr.json', 'utf8')).toBe(french);
    });

    it.each(['translations/fr.json', 'linked/fr.json'])(
      'a target file %s that --source-only leaves uncreated',
      async (metadataPath) => {
        fs.rmSync('translations/fr.json');
        link('translations', 'linked');

        await expectRejectedBeforeWriting(
          '--source-only',
          '--metadata',
          metadataPath
        );

        expect(fs.existsSync('translations/fr.json')).toBe(false);
      }
    );

    it.skipIf(process.platform === 'win32')(
      'a dangling file symlink to a source file this run would create',
      async () => {
        fs.symlinkSync(path.resolve('translations/en.json'), 'meta.json');

        await expectRejectedBeforeWriting(
          '--source-only',
          '--metadata',
          'meta.json'
        );
      }
    );

    it('a source file in a directory this run would create', async () => {
      vi.mocked(generateSettings).mockResolvedValue({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        files: {
          placeholderPaths: { gt: 'translations/generated/[locale].json' },
        },
      } as unknown as Settings);
      link('translations', 'linked');

      await expectRejectedBeforeWriting(
        '--source-only',
        '--metadata',
        'linked/generated/en.json'
      );

      expect(fs.existsSync('translations/generated')).toBe(false);
    });

    // Windows collapses `current/..` before following the junction, so there the path is the catalog.
    it.skipIf(process.platform === 'win32')(
      'but accepts a path that only spells like one before symlinks resolve',
      async () => {
        fs.writeFileSync('translations/fr.json', french);
        fs.mkdirSync('elsewhere/batch', { recursive: true });
        link('translations', 'linked');
        link('elsewhere/batch', 'translations/current');

        await run('--source-only', '--metadata', 'linked/current/../fr.json');

        expect(fs.readFileSync('translations/fr.json', 'utf8')).toBe(french);
        expect(Object.keys(read('elsewhere/fr.json'))).toEqual(
          Object.keys(sourceCatalog)
        );
      }
    );
  });

  it.each([
    ['directly', () => {}],
    [
      'through a symlinked directory',
      () => {
        fs.mkdirSync(path.join(projectRoot, 'public/_gt'), { recursive: true });
        fs.symlinkSync(
          path.join(projectRoot, 'public/_gt'),
          path.join(projectRoot, 'i18n'),
          'junction'
        );
      },
    ],
  ])(
    'refuses bare --metadata with source code snippets under public/ %s',
    async (how, setup) => {
      setup();
      const output = how === 'directly' ? 'public/_gt' : 'i18n';
      vi.mocked(generateSettings).mockResolvedValue({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        files: {
          placeholderPaths: {
            gt: path.join(projectRoot, output, '[locale].json'),
          },
          gtJson: { parsingFlags: { includeSourceCodeContext: true } },
        },
      } as unknown as Settings);
      const originalCwd = process.cwd();
      process.chdir(projectRoot);

      try {
        await expect(run('--source-only', '--metadata')).rejects.toThrow(
          'publicly served directory'
        );
      } finally {
        process.chdir(originalCwd);
      }
      expect(aggregateInlineTranslations).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(projectRoot, output, 'en.json'))).toBe(
        false
      );
      expect(
        fs.existsSync(path.join(projectRoot, output, 'en.metadata.json'))
      ).toBe(false);
    }
  );

  it.each([
    ['translations/[locale]', 'translations/en.metadata.json'],
    ['translations/[locale].JSON', 'translations/en.metadata.json'],
  ])(
    'writes the default metadata file for output %s to %s',
    async (output, expected) => {
      vi.mocked(generateSettings).mockResolvedValue({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        files: { placeholderPaths: { gt: path.join(projectRoot, output) } },
      } as unknown as Settings);

      await run('--source-only', '--metadata');

      expect(Object.keys(read(expected))).toEqual(Object.keys(sourceCatalog));
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
