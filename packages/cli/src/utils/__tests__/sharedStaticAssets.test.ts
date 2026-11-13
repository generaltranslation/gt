import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import type { Stats } from 'node:fs';
import fg from 'fast-glob';
import processSharedStaticAssets, {
  mirrorAssetsToLocales,
} from '../sharedStaticAssets';
import type { Settings } from '../../types/index.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(),
      rename: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
      copyFile: vi.fn(),
    },
  },
}));

vi.mock('node:path', () => ({
  default: {
    resolve: vi.fn(),
    relative: vi.fn(),
    dirname: vi.fn(),
    normalize: vi.fn(),
    basename: vi.fn(),
    sep: '/',
  },
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

const createFileStat = (size = 0): Stats =>
  ({
    isFile: () => true,
    size,
  }) as Stats;

const ASSET = '/project/docs/api/img/picture1.png';
const MOVED = '/project/public/shared/docs/api/img/picture1.png';

const sharedConfig = (overrides: Record<string, unknown> = {}) => ({
  include: ['docs/**/img/**/*'],
  outDir: 'public/shared',
  ...overrides,
});

const settingsWith = (
  sharedStaticAssets: unknown,
  resolvedPaths: { mdx: string[]; md: string[] } | null = { mdx: [], md: [] }
) =>
  ({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    sharedStaticAssets,
    files: resolvedPaths ? { resolvedPaths } : undefined,
  }) as unknown as Settings;

/** Makes only the given paths exist. */
const existing = (...paths: string[]) =>
  vi
    .mocked(fs.promises.stat)
    .mockImplementation((file) =>
      paths.includes(String(file))
        ? Promise.resolve(createFileStat(1024))
        : Promise.reject(new Error('Not found'))
    );

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(process, 'cwd').mockReturnValue('/project');

  vi.mocked(path.resolve).mockImplementation((base, rel) =>
    rel ? `${base}/${rel}` : base
  );
  vi.mocked(path.relative).mockImplementation((from, to) =>
    to.replace(from + '/', '')
  );
  vi.mocked(path.normalize).mockImplementation((p) => p);
  vi.mocked(path.dirname).mockImplementation((p) =>
    p.split('/').slice(0, -1).join('/')
  );
  vi.mocked(path.basename).mockImplementation((p) => p.split('/').at(-1)!);

  vi.mocked(fs.promises.readdir).mockResolvedValue([]);
  existing();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('processSharedStaticAssets', () => {
  it.each([
    ['there is no sharedStaticAssets config', undefined],
    ['the config is null', null],
    ['the include list is empty', sharedConfig({ include: [] })],
    ['include is undefined', sharedConfig({ include: undefined })],
    // Mirroring is run separately, by mirrorAssetsToLocales
    [
      'mirrorToLocales is set',
      { include: ['docs/**/*.png'], mirrorToLocales: true },
    ],
  ])('does nothing when %s', async (_name, config) => {
    await processSharedStaticAssets(settingsWith(config));

    expect(fg.sync).not.toHaveBeenCalled();
    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(fs.promises.copyFile).not.toHaveBeenCalled();
  });

  it('does nothing when no asset matches the include patterns', async () => {
    vi.mocked(fg.sync).mockReturnValue([]);

    await processSharedStaticAssets(settingsWith(sharedConfig()));

    expect(fg.sync).toHaveBeenCalled();
    expect(fs.promises.mkdir).not.toHaveBeenCalled();
  });

  describe('moving assets', () => {
    it.each<[string, Record<string, unknown>, string[], string[]]>([
      [
        'every matched asset under outDir, keeping its project-relative path',
        {
          include: [
            'docs/**/img/**/*',
            'docs/**/images/**/*',
            'content/assets/*',
          ],
        },
        [
          '/project/docs/**/img/**/*',
          '/project/docs/**/images/**/*',
          '/project/content/assets/*',
        ],
        [
          ASSET,
          '/project/docs/guide/images/diagram.svg',
          '/project/content/assets/video.mp4',
        ],
      ],
      [
        'assets matched by a pattern with a leading slash',
        { include: ['/docs/**/img/**/*'] },
        ['/project/docs/**/img/**/*'],
        [ASSET],
      ],
      [
        'assets matched by a single string pattern',
        { include: 'docs/**/img/**/*' },
        ['/project/docs/**/img/**/*'],
        [ASSET],
      ],
    ])('moves %s', async (_name, config, patterns, assets) => {
      vi.mocked(fg.sync).mockReturnValue(assets);

      await processSharedStaticAssets(settingsWith(sharedConfig(config)));

      expect(vi.mocked(fg.sync).mock.calls).toEqual(
        patterns.map((pattern) => [pattern, { absolute: true }])
      );
      expect(vi.mocked(fs.promises.rename).mock.calls).toEqual(
        assets.map((asset) => [
          asset,
          asset.replace('/project/', '/project/public/shared/'),
        ])
      );
    });

    it.each([
      ['/public/shared', MOVED],
      ['static/assets', '/project/static/assets/docs/api/img/picture1.png'],
      [
        'build/dist/assets',
        '/project/build/dist/assets/docs/api/img/picture1.png',
      ],
    ])('moves assets into outDir %j', async (outDir, destination) => {
      vi.mocked(fg.sync).mockReturnValue([ASSET]);

      await processSharedStaticAssets(settingsWith(sharedConfig({ outDir })));

      expect(fs.promises.rename).toHaveBeenCalledWith(ASSET, destination);
    });

    it('leaves an asset that is already in outDir where it is', async () => {
      vi.mocked(fg.sync).mockReturnValue([MOVED]);
      // Resolve the asset's destination back onto itself, as node:path would
      // for a file that already lives under outDir.
      vi.mocked(path.resolve).mockImplementation((base, rel) =>
        base === '/project/public/shared' && rel
          ? MOVED
          : rel
            ? `${base}/${rel}`
            : base
      );

      await processSharedStaticAssets(
        settingsWith(sharedConfig({ include: ['public/shared/**/*'] }))
      );

      expect(fs.promises.rename).not.toHaveBeenCalled();
    });

    it('removes the source instead of moving it when the destination already exists', async () => {
      vi.mocked(fg.sync).mockReturnValue([ASSET]);
      vi.mocked(fs.promises.stat)
        .mockResolvedValueOnce(createFileStat())
        .mockRejectedValue(new Error('Not found'));

      await processSharedStaticAssets(settingsWith(sharedConfig()));

      expect(fs.promises.unlink).toHaveBeenCalledWith(ASSET);
    });

    it.each([
      [
        'up to the project root',
        [],
        ['/project/docs/api/img', '/project/docs/api', '/project/docs'],
      ],
      [
        'stopping at a directory that still has content',
        ['guide'],
        ['/project/docs/api/img', '/project/docs/api'],
      ],
    ])(
      'removes the directories the move left empty, %s',
      async (_name, docsEntries, removed) => {
        vi.mocked(fg.sync).mockReturnValue([ASSET]);
        existing('/project/docs/api/img', '/project/docs/api', '/project/docs');
        vi.mocked(fs.promises.readdir).mockImplementation((async (
          dir: string
        ) => (dir === '/project/docs' ? docsEntries : [])) as never);

        await processSharedStaticAssets(settingsWith(sharedConfig()));

        expect(vi.mocked(fs.promises.rmdir).mock.calls).toEqual(
          removed.map((dir) => [dir])
        );
      }
    );

    it('copies and unlinks when the move crosses devices', async () => {
      const fileContent = Buffer.from('fake image data');
      vi.mocked(fg.sync).mockReturnValue([ASSET]);
      vi.mocked(fs.promises.rename).mockRejectedValue({ code: 'EXDEV' });
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);

      await processSharedStaticAssets(settingsWith(sharedConfig()));

      expect(fs.promises.readFile).toHaveBeenCalledWith(ASSET);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(MOVED, fileContent);
      expect(fs.promises.unlink).toHaveBeenCalledWith(ASSET);
    });

    it('rejects when a move fails for any other reason', async () => {
      vi.mocked(fg.sync).mockReturnValue([ASSET]);
      vi.mocked(fs.promises.rename).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(
        processSharedStaticAssets(settingsWith(sharedConfig()))
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('rewriting content files', () => {
    const mdxFile = '/project/docs/api/index.mdx';
    const mdFile = '/project/docs/api/guide.md';

    it('reads the MDX and MD files that exist', async () => {
      vi.mocked(fg.sync).mockReturnValue([ASSET]);
      existing(mdxFile, mdFile);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        '# Documentation\n\n![Image](./img/picture1.png)'
      );

      await processSharedStaticAssets(
        settingsWith(sharedConfig(), { mdx: [mdxFile], md: [mdFile] })
      );

      expect(fs.promises.readFile).toHaveBeenCalledWith(mdxFile, 'utf8');
      expect(fs.promises.readFile).toHaveBeenCalledWith(mdFile, 'utf8');
    });

    it.each([
      ['the content file does not exist', { mdx: [mdxFile], md: [] }],
      ['there are no content files', { mdx: [], md: [] }],
      ['there is no files config', null],
    ])('rewrites nothing when %s', async (_name, resolvedPaths) => {
      vi.mocked(fg.sync).mockReturnValue([ASSET]);

      await processSharedStaticAssets(
        settingsWith(sharedConfig(), resolvedPaths)
      );

      expect(fs.promises.readFile).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
});

describe('mirrorAssetsToLocales', () => {
  const mirrorSettings = (include: string[], files: unknown = {}) =>
    ({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es', 'ja'],
      // No outDir: mirroring copies next to each locale's content.
      sharedStaticAssets: { include, mirrorToLocales: true },
      files: files && {
        resolvedPaths: { mdx: [], md: [] },
        placeholderPaths: { mdx: [], md: [] },
        transformPaths: { mdx: undefined, md: undefined },
      },
    }) as unknown as Settings;

  it.each<[string, string, Record<string, Record<string, string>>, string[]]>([
    [
      'next to the translated page, for every locale',
      '/project/docs/guide/images/diagram.png',
      {
        fr: { 'docs/guide/intro.mdx': 'i18n/fr/docs/guide/intro.mdx' },
        es: { 'docs/guide/intro.mdx': 'i18n/es/docs/guide/intro.mdx' },
      },
      [
        '/project/i18n/fr/docs/guide/images/diagram.png',
        '/project/i18n/es/docs/guide/images/diagram.png',
      ],
    ],
    [
      // The asset is in docs/images/ but pages are only in docs/guide/:
      // docs/ -> ja/docs/ is inferred from docs/guide/ -> ja/docs/guide/.
      'under an ancestor directory shared with a sibling page',
      '/project/docs/images/datastore_architecture.png',
      { ja: { 'docs/guide/page.mdx': 'ja/docs/guide/page.mdx' } },
      ['/project/ja/docs/images/datastore_architecture.png'],
    ],
    [
      'keeping nested subdirectories',
      '/project/docs/guide/advanced/images/deep/nested.svg',
      {
        fr: {
          'docs/guide/advanced/page.mdx':
            'i18n/fr/docs/guide/advanced/page.mdx',
        },
      },
      ['/project/i18n/fr/docs/guide/advanced/images/deep/nested.svg'],
    ],
  ])('copies an asset %s', async (_name, asset, mapping, copies) => {
    vi.mocked(fg.sync).mockReturnValue([asset]);
    vi.mocked(createFileMapping).mockReturnValue(mapping);

    await mirrorAssetsToLocales(mirrorSettings(['docs/**/*']));

    expect(vi.mocked(fs.promises.copyFile).mock.calls).toEqual(
      copies.map((copy) => [asset, copy])
    );
    // The original asset is neither moved nor deleted.
    expect(fs.promises.rename).not.toHaveBeenCalled();
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });

  it('skips a copy whose target already exists with the same size', async () => {
    const asset = '/project/docs/images/pic.png';
    vi.mocked(fg.sync).mockReturnValue([asset]);
    vi.mocked(createFileMapping).mockReturnValue({
      fr: { 'docs/page.mdx': 'i18n/fr/docs/page.mdx' },
    });
    existing(asset, '/project/i18n/fr/docs/images/pic.png');

    await mirrorAssetsToLocales(mirrorSettings(['docs/**/images/**/*']));

    expect(fs.promises.copyFile).not.toHaveBeenCalled();
  });

  it('does nothing without a files config', async () => {
    await mirrorAssetsToLocales(mirrorSettings(['docs/**/images/**/*'], null));

    expect(fg.sync).not.toHaveBeenCalled();
    expect(fs.promises.copyFile).not.toHaveBeenCalled();
  });
});
