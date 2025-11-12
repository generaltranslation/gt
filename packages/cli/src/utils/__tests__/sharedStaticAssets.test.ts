import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import fg from 'fast-glob';
import processSharedStaticAssets from '../sharedStaticAssets';
import type { Settings } from '../../types/index.js';

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
  },
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

describe('processSharedStaticAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    // Setup default path mocks
    vi.mocked(path.resolve).mockImplementation((base, rel) =>
      rel ? `${base}/${rel}` : base
    );
    vi.mocked(path.relative).mockImplementation((from, to) => {
      return to.replace(from + '/', '');
    });
    vi.mocked(path.normalize).mockImplementation((p) => p);
    vi.mocked(path.dirname).mockImplementation((p) => {
      const parts = p.split('/');
      return parts.slice(0, -1).join('/');
    });
    vi.mocked(path.basename).mockImplementation((p) => {
      const parts = p.split('/');
      return parts[parts.length - 1];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('early returns', () => {
    it('should return early if no sharedStaticAssets config', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it('should return early if sharedStaticAssets config is null', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: null,
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it('should return early if include array is empty', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: [],
          outDir: 'public/shared',
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it('should return early if no assets found by glob patterns', async () => {
      vi.mocked(fg.sync).mockReturnValue([]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).toHaveBeenCalled();
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('asset discovery and moving', () => {
    beforeEach(() => {
      // Mock fs operations
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.rmdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('Not found'));
    });

    it('should find and move single asset file', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).toHaveBeenCalledWith('/project/docs/**/img/**/*', {
        absolute: true,
      });
      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/public/shared/docs/api/img/picture1.png'
      );
    });

    it('should handle multiple asset files', async () => {
      const assetPaths = [
        '/project/docs/api/img/picture1.png',
        '/project/docs/guide/images/diagram.svg',
        '/project/content/assets/video.mp4',
      ];
      vi.mocked(fg.sync).mockReturnValue(assetPaths);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: [
            'docs/**/img/**/*',
            'docs/**/images/**/*',
            'content/assets/*',
          ],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).toHaveBeenCalledTimes(3);
      expect(fs.promises.rename).toHaveBeenCalledWith(
        '/project/docs/api/img/picture1.png',
        '/project/public/shared/docs/api/img/picture1.png'
      );
      expect(fs.promises.rename).toHaveBeenCalledWith(
        '/project/docs/guide/images/diagram.svg',
        '/project/public/shared/docs/guide/images/diagram.svg'
      );
      expect(fs.promises.rename).toHaveBeenCalledWith(
        '/project/content/assets/video.mp4',
        '/project/public/shared/content/assets/video.mp4'
      );
    });

    it('should handle leading slash in include patterns', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['/docs/**/img/**/*'], // Leading slash should be stripped
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).toHaveBeenCalledWith('/project/docs/**/img/**/*', {
        absolute: true,
      });
    });

    it('should handle leading slash in outDir', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: '/public/shared', // Leading slash should be stripped
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/public/shared/docs/api/img/picture1.png'
      );
    });

    it('should skip files already in destination', async () => {
      const assetPath = '/project/public/shared/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      // Mock path.relative to return the relative path correctly
      vi.mocked(path.relative).mockImplementation((from, to) => {
        if (
          from === '/project' &&
          to === '/project/public/shared/docs/api/img/picture1.png'
        ) {
          return 'public/shared/docs/api/img/picture1.png';
        }
        return to.replace(from + '/', '');
      });

      // Mock path.resolve to handle destination calculation correctly
      vi.mocked(path.resolve).mockImplementation((base, rel) => {
        if (
          base === '/project/public/shared' &&
          rel === 'public/shared/docs/api/img/picture1.png'
        ) {
          return '/project/public/shared/docs/api/img/picture1.png'; // Same as source
        }
        if (base === '/project' && rel) {
          return `${base}/${rel}`;
        }
        return base;
      });

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['public/shared/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).not.toHaveBeenCalled();
    });

    it('should handle destination file already exists scenario', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';

      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.stat)
        .mockResolvedValueOnce({ isFile: () => true } as any) // Destination exists
        .mockRejectedValue(new Error('Not found')); // Source doesn't exist anymore after unlink

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.unlink).toHaveBeenCalledWith(assetPath);
    });
  });

  describe('MDX content rewriting integration tests', () => {
    beforeEach(() => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.rmdir).mockResolvedValue(undefined);
    });

    it('should attempt to rewrite MDX files when assets are moved', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      const mdxFile = '/project/docs/api/index.mdx';
      const originalContent =
        '# API Documentation\n\n![Screenshot](./img/picture1.png)\n\nSome text.';

      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.stat).mockImplementation((path) => {
        if (path === mdxFile) {
          return Promise.resolve({} as any); // MDX file exists
        }
        return Promise.reject(new Error('Not found')); // Everything else doesn't exist
      });
      vi.mocked(fs.promises.readFile).mockResolvedValue(originalContent);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [mdxFile],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      // Verify that the function attempts to read the MDX file
      expect(fs.promises.readFile).toHaveBeenCalledWith(mdxFile, 'utf8');
    });

    it('should skip rewriting if MDX file does not exist', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      const mdxFile = '/project/docs/api/index.mdx';

      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.stat).mockImplementation((path) => {
        // All files don't exist
        return Promise.reject(new Error('File not found'));
      });

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [mdxFile],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.readFile).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should process both MDX and MD files', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      const mdxFile = '/project/docs/api/index.mdx';
      const mdFile = '/project/docs/api/guide.md';
      const originalContent = '# Documentation\n\n![Image](./img/picture1.png)';

      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.stat).mockImplementation((path) => {
        if (path === mdxFile || path === mdFile) {
          return Promise.resolve({} as any); // Files exist
        }
        return Promise.reject(new Error('Not found')); // Everything else doesn't exist
      });
      vi.mocked(fs.promises.readFile).mockResolvedValue(originalContent);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [mdxFile],
            md: [mdFile],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.readFile).toHaveBeenCalledWith(mdxFile, 'utf8');
      expect(fs.promises.readFile).toHaveBeenCalledWith(mdFile, 'utf8');
    });

    it('should handle empty files array gracefully', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.readFile).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should handle missing files config', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: undefined,
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.readFile).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('public path derivation', () => {
    beforeEach(() => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.rmdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('Not found'));
    });

    it('should derive publicPath from outDir starting with "public/"', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/public/shared/docs/api/img/picture1.png'
      );
    });

    it('should derive publicPath from outDir starting with "static/"', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'static/assets',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/static/assets/docs/api/img/picture1.png'
      );
    });

    it('should use basename of outDir as fallback publicPath', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'build/dist/assets',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/build/dist/assets/docs/api/img/picture1.png'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Mock path operations
      vi.mocked(path.resolve).mockImplementation((base, rel) =>
        rel ? `${base}/${rel}` : base
      );
      vi.mocked(path.relative).mockImplementation((from, to) => {
        return to.replace(from + '/', '');
      });
      vi.mocked(path.normalize).mockImplementation((p) => p);
      vi.mocked(path.dirname).mockImplementation((p) => {
        const parts = p.split('/');
        return parts.slice(0, -1).join('/');
      });
    });

    it('should handle file move errors gracefully', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockRejectedValue(
        new Error('Permission denied')
      );

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await expect(processSharedStaticAssets(settings)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should handle cross-device move by copying and unlinking', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      const fileContent = Buffer.from('fake image data');

      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockRejectedValue({ code: 'EXDEV' });
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.rmdir).mockResolvedValue(undefined);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: ['docs/**/img/**/*'],
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fs.promises.readFile).toHaveBeenCalledWith(assetPath);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/project/public/shared/docs/api/img/picture1.png',
        fileContent
      );
      expect(fs.promises.unlink).toHaveBeenCalledWith(assetPath);
    });
  });

  describe('config types', () => {
    beforeEach(() => {
      // Mock path operations
      vi.mocked(path.resolve).mockImplementation((base, rel) =>
        rel ? `${base}/${rel}` : base
      );
      vi.mocked(path.relative).mockImplementation((from, to) => {
        return to.replace(from + '/', '');
      });
      vi.mocked(path.normalize).mockImplementation((p) => p);
    });

    it('should handle include as string instead of array', async () => {
      const assetPath = '/project/docs/api/img/picture1.png';
      vi.mocked(fg.sync).mockReturnValue([assetPath]);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.rmdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('Not found'));

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: 'docs/**/img/**/*', // String instead of array
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).toHaveBeenCalledWith('/project/docs/**/img/**/*', {
        absolute: true,
      });
      expect(fs.promises.rename).toHaveBeenCalledWith(
        assetPath,
        '/project/public/shared/docs/api/img/picture1.png'
      );
    });

    it('should handle include as undefined', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        sharedStaticAssets: {
          include: undefined,
          outDir: 'public/shared',
        },
        files: {
          resolvedPaths: {
            mdx: [],
            md: [],
          },
        },
      } as Settings;

      await processSharedStaticAssets(settings);

      expect(fg.sync).not.toHaveBeenCalled();
    });
  });
});
