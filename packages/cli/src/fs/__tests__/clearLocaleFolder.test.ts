import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'node:path';
import { clearLocaleFolders } from '../clearLocaleFolders.js';
import os from 'os';

describe('clearLocaleFolders', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clear-locale-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should delete locale directories with simple locale codes', async () => {
    // Create test structure: snippets/es/file.mdx
    const esDir = path.join(testDir, 'snippets', 'es');
    await fs.mkdir(esDir, { recursive: true });
    await fs.writeFile(path.join(esDir, 'file.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'file.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['es']);

    // Verify the es directory was deleted
    await expect(fs.access(esDir)).rejects.toThrow();
    // Verify parent directory still exists
    await expect(
      fs.access(path.join(testDir, 'snippets'))
    ).resolves.toBeUndefined();
  });

  it('should delete locale directories with nested files', async () => {
    // Create test structure: snippets/es/api-test/introduction.mdx
    const nestedDir = path.join(testDir, 'snippets', 'es', 'api-test');
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, 'introduction.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'api-test', 'introduction.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['es']);

    // Verify the es directory (and all contents) was deleted
    await expect(
      fs.access(path.join(testDir, 'snippets', 'es'))
    ).rejects.toThrow();
  });

  it('should handle multiple locale directories', async () => {
    // Create multiple locale directories
    const esDir = path.join(testDir, 'snippets', 'es');
    const frDir = path.join(testDir, 'snippets', 'fr');
    const deDir = path.join(testDir, 'docs', 'de');

    await fs.mkdir(esDir, { recursive: true });
    await fs.mkdir(frDir, { recursive: true });
    await fs.mkdir(deDir, { recursive: true });

    await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content');
    await fs.writeFile(path.join(frDir, 'file2.mdx'), 'content');
    await fs.writeFile(path.join(deDir, 'file3.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'file1.mdx'),
      path.join(testDir, 'snippets', 'fr', 'file2.mdx'),
      path.join(testDir, 'docs', 'de', 'file3.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['es', 'fr', 'de']);

    // Verify all locale directories were deleted
    await expect(fs.access(esDir)).rejects.toThrow();
    await expect(fs.access(frDir)).rejects.toThrow();
    await expect(fs.access(deDir)).rejects.toThrow();
  });

  it('should handle locale codes with country codes (en-US, zh-CN)', async () => {
    // Create test structure with country-specific locales
    const enUSDir = path.join(testDir, 'content', 'en-US');
    const zhCNDir = path.join(testDir, 'content', 'zh-CN');

    await fs.mkdir(enUSDir, { recursive: true });
    await fs.mkdir(zhCNDir, { recursive: true });

    await fs.writeFile(path.join(enUSDir, 'file.mdx'), 'content');
    await fs.writeFile(path.join(zhCNDir, 'file.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'content', 'en-US', 'file.mdx'),
      path.join(testDir, 'content', 'zh-CN', 'file.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['en-US', 'zh-CN']);

    // Verify locale directories were deleted
    await expect(fs.access(enUSDir)).rejects.toThrow();
    await expect(fs.access(zhCNDir)).rejects.toThrow();
  });

  it('should not delete directories that do not match locale patterns', async () => {
    // Create a directory that looks like it could be a locale but isn't
    const notLocaleDir = path.join(testDir, 'components', 'button');
    await fs.mkdir(notLocaleDir, { recursive: true });
    await fs.writeFile(path.join(notLocaleDir, 'file.tsx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'components', 'button', 'file.tsx'),
    ]);

    await clearLocaleFolders(filePaths, ['es', 'fr']);

    // Verify the directory was NOT deleted (no locale pattern found)
    await expect(fs.access(notLocaleDir)).resolves.toBeUndefined();
  });

  it('should handle already deleted directories gracefully', async () => {
    // Don't create the directory, just reference it

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'file.mdx'),
    ]);

    // Should not throw an error
    await expect(
      clearLocaleFolders(filePaths, ['es'])
    ).resolves.toBeUndefined();
  });

  it('should handle multiple files in the same locale directory', async () => {
    const esDir = path.join(testDir, 'snippets', 'es');
    await fs.mkdir(esDir, { recursive: true });
    await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
    await fs.writeFile(path.join(esDir, 'file2.mdx'), 'content2');
    await fs.writeFile(path.join(esDir, 'file3.mdx'), 'content3');

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'file1.mdx'),
      path.join(testDir, 'snippets', 'es', 'file2.mdx'),
      path.join(testDir, 'snippets', 'es', 'file3.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['es']);

    // Should only delete the directory once
    await expect(fs.access(esDir)).rejects.toThrow();
  });

  it('should extract the correct locale directory from deeply nested paths', async () => {
    // Create deeply nested structure
    const deepPath = path.join(
      testDir,
      'docs',
      'v2',
      'es',
      'guides',
      'advanced',
      'chapter1.mdx'
    );
    await fs.mkdir(path.dirname(deepPath), { recursive: true });
    await fs.writeFile(deepPath, 'content');

    const filePaths = new Set([deepPath]);

    await clearLocaleFolders(filePaths, ['es']);

    // Should delete docs/v2/es and everything inside it
    const esDir = path.join(testDir, 'docs', 'v2', 'es');
    await expect(fs.access(esDir)).rejects.toThrow();

    // Parent directories should still exist
    await expect(
      fs.access(path.join(testDir, 'docs', 'v2'))
    ).resolves.toBeUndefined();
  });

  it('should handle pt-BR locale code', async () => {
    const ptBRDir = path.join(testDir, 'content', 'pt-BR');
    await fs.mkdir(ptBRDir, { recursive: true });
    await fs.writeFile(path.join(ptBRDir, 'file.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'content', 'pt-BR', 'file.mdx'),
    ]);

    await clearLocaleFolders(filePaths, ['pt-BR']);

    // Verify pt-BR directory was deleted
    await expect(fs.access(ptBRDir)).rejects.toThrow();
  });

  describe('with exclude patterns', () => {
    it('should exclude files matching glob patterns with [locale]', async () => {
      // Create test structure with files to exclude
      const esDir = path.join(testDir, 'snippets', 'es');
      const preservedDir = path.join(esDir, 'preserved');
      await fs.mkdir(preservedDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(esDir, 'file2.mdx'), 'content2');
      await fs.writeFile(path.join(preservedDir, 'keep-me.mdx'), 'preserved');

      const filePaths = new Set([
        path.join(esDir, 'file1.mdx'),
        path.join(esDir, 'file2.mdx'),
        path.join(preservedDir, 'keep-me.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'snippets', '[locale]', 'preserved', '**'),
      ];

      await clearLocaleFolders(filePaths, ['es'], excludePatterns);

      // Regular files should be deleted
      await expect(fs.access(path.join(esDir, 'file1.mdx'))).rejects.toThrow();
      await expect(fs.access(path.join(esDir, 'file2.mdx'))).rejects.toThrow();

      // Excluded files should still exist
      await expect(
        fs.access(path.join(preservedDir, 'keep-me.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should exclude specific files by name', async () => {
      const esDir = path.join(testDir, 'docs', 'es');
      await fs.mkdir(esDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'intro.mdx'), 'content');
      await fs.writeFile(path.join(esDir, 'keep-me.mdx'), 'preserved');
      await fs.writeFile(path.join(esDir, 'guide.mdx'), 'content');

      const filePaths = new Set([
        path.join(esDir, 'intro.mdx'),
        path.join(esDir, 'keep-me.mdx'),
        path.join(esDir, 'guide.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'docs', '[locale]', 'keep-me.mdx'),
      ];

      await clearLocaleFolders(filePaths, ['es'], excludePatterns);

      // Regular files should be deleted
      await expect(fs.access(path.join(esDir, 'intro.mdx'))).rejects.toThrow();
      await expect(fs.access(path.join(esDir, 'guide.mdx'))).rejects.toThrow();

      // Excluded file should still exist
      await expect(
        fs.access(path.join(esDir, 'keep-me.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should work with multiple exclude patterns', async () => {
      const esDir = path.join(testDir, 'content', 'es');
      const preservedDir = path.join(esDir, 'preserved');
      const staticDir = path.join(esDir, 'static');

      await fs.mkdir(preservedDir, { recursive: true });
      await fs.mkdir(staticDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(preservedDir, 'keep1.mdx'), 'preserved1');
      await fs.writeFile(path.join(staticDir, 'keep2.mdx'), 'preserved2');

      const filePaths = new Set([
        path.join(esDir, 'file1.mdx'),
        path.join(preservedDir, 'keep1.mdx'),
        path.join(staticDir, 'keep2.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'content', '[locale]', 'preserved', '**'),
        path.join(testDir, 'content', '[locale]', 'static', '**'),
      ];

      await clearLocaleFolders(filePaths, ['es'], excludePatterns);

      // Regular file should be deleted
      await expect(fs.access(path.join(esDir, 'file1.mdx'))).rejects.toThrow();

      // Both excluded directories should still exist with files
      await expect(
        fs.access(path.join(preservedDir, 'keep1.mdx'))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(staticDir, 'keep2.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should handle [locale] placeholder for multiple locales', async () => {
      const esDir = path.join(testDir, 'snippets', 'es');
      const frDir = path.join(testDir, 'snippets', 'fr');
      const esPreservedDir = path.join(esDir, 'preserved');
      const frPreservedDir = path.join(frDir, 'preserved');

      await fs.mkdir(esPreservedDir, { recursive: true });
      await fs.mkdir(frPreservedDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(frDir, 'file2.mdx'), 'content2');
      await fs.writeFile(
        path.join(esPreservedDir, 'keep-es.mdx'),
        'preserved-es'
      );
      await fs.writeFile(
        path.join(frPreservedDir, 'keep-fr.mdx'),
        'preserved-fr'
      );

      const filePaths = new Set([
        path.join(esDir, 'file1.mdx'),
        path.join(frDir, 'file2.mdx'),
        path.join(esPreservedDir, 'keep-es.mdx'),
        path.join(frPreservedDir, 'keep-fr.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'snippets', '[locale]', 'preserved', '**'),
      ];

      await clearLocaleFolders(filePaths, ['es', 'fr'], excludePatterns);

      // Regular files should be deleted
      await expect(fs.access(path.join(esDir, 'file1.mdx'))).rejects.toThrow();
      await expect(fs.access(path.join(frDir, 'file2.mdx'))).rejects.toThrow();

      // Excluded files in both locales should still exist
      await expect(
        fs.access(path.join(esPreservedDir, 'keep-es.mdx'))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(frPreservedDir, 'keep-fr.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should delete entire directory when no exclude patterns provided', async () => {
      const esDir = path.join(testDir, 'snippets', 'es');
      const subDir = path.join(esDir, 'sub');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(subDir, 'file2.mdx'), 'content2');

      const filePaths = new Set([
        path.join(esDir, 'file1.mdx'),
        path.join(subDir, 'file2.mdx'),
      ]);

      // No exclude patterns - should delete everything
      await clearLocaleFolders(filePaths, ['es']);

      // Entire directory should be gone
      await expect(fs.access(esDir)).rejects.toThrow();
    });

    it('should clean up empty directories after selective deletion', async () => {
      const esDir = path.join(testDir, 'content', 'es');
      const emptyAfterDir = path.join(esDir, 'will-be-empty');
      const preservedDir = path.join(esDir, 'preserved');

      await fs.mkdir(emptyAfterDir, { recursive: true });
      await fs.mkdir(preservedDir, { recursive: true });

      await fs.writeFile(path.join(emptyAfterDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(preservedDir, 'keep.mdx'), 'preserved');

      const filePaths = new Set([
        path.join(emptyAfterDir, 'file1.mdx'),
        path.join(preservedDir, 'keep.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'content', '[locale]', 'preserved', '**'),
      ];

      await clearLocaleFolders(filePaths, ['es'], excludePatterns);

      // Empty directory should be cleaned up
      await expect(fs.access(emptyAfterDir)).rejects.toThrow();

      // Preserved directory should still exist
      await expect(fs.access(preservedDir)).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(preservedDir, 'keep.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should handle glob patterns with wildcards', async () => {
      const esDir = path.join(testDir, 'docs', 'es');
      await fs.mkdir(esDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'intro.mdx'), 'content');
      await fs.writeFile(path.join(esDir, 'keep-this.mdx'), 'preserved1');
      await fs.writeFile(path.join(esDir, 'keep-that.mdx'), 'preserved2');
      await fs.writeFile(path.join(esDir, 'guide.mdx'), 'content');

      const filePaths = new Set([
        path.join(esDir, 'intro.mdx'),
        path.join(esDir, 'keep-this.mdx'),
        path.join(esDir, 'keep-that.mdx'),
        path.join(esDir, 'guide.mdx'),
      ]);

      const excludePatterns = [
        path.join(testDir, 'docs', '[locale]', 'keep-*.mdx'),
      ];

      await clearLocaleFolders(filePaths, ['es'], excludePatterns);

      // Regular files should be deleted
      await expect(fs.access(path.join(esDir, 'intro.mdx'))).rejects.toThrow();
      await expect(fs.access(path.join(esDir, 'guide.mdx'))).rejects.toThrow();

      // Files matching keep-*.mdx should still exist
      await expect(
        fs.access(path.join(esDir, 'keep-this.mdx'))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(esDir, 'keep-that.mdx'))
      ).resolves.toBeUndefined();
    });

    it('should handle [locales] placeholder to exclude across all locales', async () => {
      const esDir = path.join(testDir, 'content', 'es');
      const frDir = path.join(testDir, 'content', 'fr');
      const esStaticDir = path.join(esDir, 'static');
      const frStaticDir = path.join(frDir, 'static');

      await fs.mkdir(esStaticDir, { recursive: true });
      await fs.mkdir(frStaticDir, { recursive: true });

      await fs.writeFile(path.join(esDir, 'file1.mdx'), 'content1');
      await fs.writeFile(path.join(frDir, 'file2.mdx'), 'content2');
      await fs.writeFile(path.join(esStaticDir, 'keep-es.png'), 'image-es');
      await fs.writeFile(path.join(frStaticDir, 'keep-fr.png'), 'image-fr');

      const filePaths = new Set([
        path.join(esDir, 'file1.mdx'),
        path.join(frDir, 'file2.mdx'),
        path.join(esStaticDir, 'keep-es.png'),
        path.join(frStaticDir, 'keep-fr.png'),
      ]);

      // [locales] should match all target locales (es, fr)
      const excludePatterns = [
        path.join(testDir, 'content', '[locales]', 'static', '**'),
      ];

      await clearLocaleFolders(filePaths, ['es', 'fr'], excludePatterns);

      // Regular files should be deleted
      await expect(fs.access(path.join(esDir, 'file1.mdx'))).rejects.toThrow();
      await expect(fs.access(path.join(frDir, 'file2.mdx'))).rejects.toThrow();

      // Static files in both locales should still exist
      await expect(
        fs.access(path.join(esStaticDir, 'keep-es.png'))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(frStaticDir, 'keep-fr.png'))
      ).resolves.toBeUndefined();
    });
  });
});
