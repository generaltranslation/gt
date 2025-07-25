import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import copyFile from '../copyFile';

// Mock fs module
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(),
      copyFile: vi.fn(),
    },
  },
}));

// Mock path module
vi.mock('node:path', () => ({
  default: {
    join: vi.fn(),
    dirname: vi.fn(),
  },
}));

describe('copyFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('early returns', () => {
    it('should return early if copyFiles is not provided', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {},
      };

      await copyFile(settings as any);

      expect(fs.promises.mkdir).not.toHaveBeenCalled();
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });

    it('should return early if copyFiles is null', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: null,
        },
      };

      await copyFile(settings as any);

      expect(fs.promises.mkdir).not.toHaveBeenCalled();
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });

    it('should return early if copyFiles is an empty array', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: [],
        },
      };

      await copyFile(settings as any);

      expect(fs.promises.mkdir).not.toHaveBeenCalled();
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });
  });

  describe('file copying', () => {
    beforeEach(() => {
      // Mock path.join to return predictable paths
      vi.mocked(path.join).mockImplementation((...segments) =>
        segments.join('/')
      );

      // Mock path.dirname to return the directory
      vi.mocked(path.dirname).mockImplementation((filePath) => {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/');
      });

      // Mock fs operations to resolve successfully
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.copyFile).mockResolvedValue(undefined);
    });

    it('should copy a single file to target locales', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr', 'es'],
        options: {
          copyFiles: ['assets/[locale]/config.json'],
        },
      };

      await copyFile(settings as any);

      // Should create directories for target locales
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/assets/fr', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/assets/es', {
        recursive: true,
      });

      // Should copy files from source to target locales
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/config.json',
        '/project/assets/fr/config.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/config.json',
        '/project/assets/es/config.json'
      );
    });

    it('should copy multiple files to target locales', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          copyFiles: [
            'assets/[locale]/config.json',
            'public/[locale]/manifest.json',
          ],
        },
      };

      await copyFile(settings as any);

      // Should create directories for both files and target locale
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/assets/ja', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/public/ja', {
        recursive: true,
      });

      // Should copy both files to target locale
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/config.json',
        '/project/assets/ja/config.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/public/en/manifest.json',
        '/project/public/ja/manifest.json'
      );
    });

    it('should handle multiple target locales', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr', 'de', 'es', 'ja'],
        options: {
          copyFiles: ['data/[locale]/database.json'],
        },
      };

      await copyFile(settings as any);

      // Should create directories for all target locales (excluding default)
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(4);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/data/fr', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/data/de', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/data/es', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/data/ja', {
        recursive: true,
      });

      // Should copy file to all target locales
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(4);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/data/en/database.json',
        '/project/data/fr/database.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/data/en/database.json',
        '/project/data/de/database.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/data/en/database.json',
        '/project/data/es/database.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/data/en/database.json',
        '/project/data/ja/database.json'
      );
    });

    it('should skip copying to the default locale', async () => {
      const settings = {
        defaultLocale: 'fr',
        locales: ['en', 'fr', 'es'],
        options: {
          copyFiles: ['config/[locale]/settings.json'],
        },
      };

      await copyFile(settings as any);

      // Should only create directories for non-default locales
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/config/en', {
        recursive: true,
      });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/config/es', {
        recursive: true,
      });

      // Should only copy to non-default locales
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/config/fr/settings.json',
        '/project/config/en/settings.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/config/fr/settings.json',
        '/project/config/es/settings.json'
      );
    });

    it('should handle nested directory structures', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          copyFiles: ['assets/deep/nested/[locale]/config/file.json'],
        },
      };

      await copyFile(settings as any);

      // Should create the nested directory structure
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        '/project/assets/deep/nested/ja/config',
        { recursive: true }
      );

      // Should copy the file to the nested structure
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(1);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/deep/nested/en/config/file.json',
        '/project/assets/deep/nested/ja/config/file.json'
      );
    });

    it('should handle files with different extensions', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: [
            'assets/[locale]/config.json',
            'assets/[locale]/styles.css',
            'assets/[locale]/script.js',
            'assets/[locale]/image.png',
          ],
        },
      };

      await copyFile(settings as any);

      // Should create directory once for all files in same directory
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(4);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/assets/fr', {
        recursive: true,
      });

      // Should copy all different file types
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(4);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/config.json',
        '/project/assets/fr/config.json'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/styles.css',
        '/project/assets/fr/styles.css'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/script.js',
        '/project/assets/fr/script.js'
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/en/image.png',
        '/project/assets/fr/image.png'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(path.join).mockImplementation((...segments) =>
        segments.join('/')
      );
      vi.mocked(path.dirname).mockImplementation((filePath) => {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/');
      });
    });

    it('should propagate mkdir errors', async () => {
      const mkdirError = new Error('Permission denied');
      vi.mocked(fs.promises.mkdir).mockRejectedValue(mkdirError);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: ['assets/[locale]/config.json'],
        },
      };

      await expect(copyFile(settings as any)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should propagate copyFile errors', async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);

      const copyError = new Error('Source file not found');
      vi.mocked(fs.promises.copyFile).mockRejectedValue(copyError);

      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: ['assets/[locale]/config.json'],
        },
      };

      await expect(copyFile(settings as any)).rejects.toThrow(
        'Source file not found'
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      vi.mocked(path.join).mockImplementation((...segments) =>
        segments.join('/')
      );
      vi.mocked(path.dirname).mockImplementation((filePath) => {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/');
      });
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.copyFile).mockResolvedValue(undefined);
    });

    it('should handle single locale (only default)', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en'],
        options: {
          copyFiles: ['assets/[locale]/config.json'],
        },
      };

      await copyFile(settings as any);

      // Should not create any directories or copy any files
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
      expect(fs.promises.copyFile).not.toHaveBeenCalled();
    });

    it('should handle file templates without [locale] placeholder', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          copyFiles: ['assets/static-file.json'],
        },
      };

      await copyFile(settings as any);

      // Should create directory
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/project/assets', {
        recursive: true,
      });

      // Should copy file (template remains unchanged without [locale])
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(1);
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/assets/static-file.json',
        '/project/assets/static-file.json'
      );
    });

    it('should handle complex file paths with multiple directory levels', async () => {
      const settings = {
        defaultLocale: 'en',
        locales: ['en', 'zh-CN'],
        options: {
          copyFiles: ['src/components/ui/[locale]/translations/messages.json'],
        },
      };

      await copyFile(settings as any);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        '/project/src/components/ui/zh-CN/translations',
        { recursive: true }
      );
      expect(fs.promises.copyFile).toHaveBeenCalledWith(
        '/project/src/components/ui/en/translations/messages.json',
        '/project/src/components/ui/zh-CN/translations/messages.json'
      );
    });
  });
});
