import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import copyFile from '../copyFile';
import { logger } from '../../console/logger.js';

vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(),
      copyFile: vi.fn(),
    },
    existsSync: vi.fn(),
  },
}));
vi.mock('../../console/logger.js');

const inProject = (file: string) => path.join('/project', file);
const copies = () =>
  vi
    .mocked(fs.promises.copyFile)
    .mock.calls.map(([source, target]) => [source, target]);
const createdDirectories = () =>
  vi.mocked(fs.promises.mkdir).mock.calls.map(([directory]) => directory);

describe('copyFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.copyFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['copyFiles is not configured', {}, ['en', 'fr']],
    ['copyFiles is empty', { copyFiles: [] }, ['en', 'fr']],
    [
      'the default locale is the only locale',
      { copyFiles: ['assets/[locale]/config.json'] },
      ['en'],
    ],
  ])('does nothing when %s', async (_case, options, locales) => {
    await copyFile({ defaultLocale: 'en', locales, options });

    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(fs.promises.copyFile).not.toHaveBeenCalled();
  });

  it('copies every configured file from the default locale to each other locale', async () => {
    await copyFile({
      defaultLocale: 'fr',
      locales: ['en', 'fr', 'zh-CN'],
      options: {
        copyFiles: [
          'assets/[locale]/config.json',
          'src/deep/[locale]/nested/messages.json',
        ],
      },
    });

    expect(copies()).toEqual([
      [inProject('assets/fr/config.json'), inProject('assets/en/config.json')],
      [
        inProject('assets/fr/config.json'),
        inProject('assets/zh-CN/config.json'),
      ],
      [
        inProject('src/deep/fr/nested/messages.json'),
        inProject('src/deep/en/nested/messages.json'),
      ],
      [
        inProject('src/deep/fr/nested/messages.json'),
        inProject('src/deep/zh-CN/nested/messages.json'),
      ],
    ]);
    expect(createdDirectories()).toEqual([
      inProject('assets/en'),
      inProject('assets/zh-CN'),
      inProject('src/deep/en/nested'),
      inProject('src/deep/zh-CN/nested'),
    ]);
    expect(fs.promises.mkdir).toHaveBeenCalledWith(inProject('assets/en'), {
      recursive: true,
    });
  });

  it('copies a template without [locale] onto itself', async () => {
    await copyFile({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      options: { copyFiles: ['assets/static-file.json'] },
    });

    expect(copies()).toEqual([
      [
        inProject('assets/static-file.json'),
        inProject('assets/static-file.json'),
      ],
    ]);
  });

  it('reports each missing source file and still copies the others', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (file) => file === inProject('public/en/manifest.json')
    );

    await copyFile({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      options: {
        copyFiles: [
          'assets/[locale]/config.json',
          'public/[locale]/manifest.json',
          'data/[locale]/seed.json',
        ],
      },
    });

    expect(vi.mocked(logger.error).mock.calls).toEqual([
      [
        `Failed to copy files: File path does not exist: ${inProject('assets/en/config.json')}`,
      ],
      [
        `Failed to copy files: File path does not exist: ${inProject('data/en/seed.json')}`,
      ],
    ]);
    expect(createdDirectories()).toEqual([inProject('public/fr')]);
    expect(copies()).toEqual([
      [
        inProject('public/en/manifest.json'),
        inProject('public/fr/manifest.json'),
      ],
    ]);
  });

  it.each(['mkdir', 'copyFile'] as const)(
    'propagates %s errors',
    async (operation) => {
      vi.mocked(fs.promises[operation]).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(
        copyFile({
          defaultLocale: 'en',
          locales: ['en', 'fr'],
          options: { copyFiles: ['assets/[locale]/config.json'] },
        })
      ).rejects.toThrow('Permission denied');
    }
  );
});
