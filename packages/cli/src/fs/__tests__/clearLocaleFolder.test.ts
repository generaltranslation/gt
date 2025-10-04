import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'node:path';
import { clearTranslatedFiles } from '../clearLocaleFolder.js';
import os from 'os';

describe('clearTranslatedFiles', () => {
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

    await clearTranslatedFiles(filePaths, ['es']);

    // Verify the es directory was deleted
    await expect(fs.access(esDir)).rejects.toThrow();
    // Verify parent directory still exists
    await expect(fs.access(path.join(testDir, 'snippets'))).resolves.toBeUndefined();
  });

  it('should delete locale directories with nested files', async () => {
    // Create test structure: snippets/es/api-test/introduction.mdx
    const nestedDir = path.join(testDir, 'snippets', 'es', 'api-test');
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, 'introduction.mdx'), 'content');

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'api-test', 'introduction.mdx'),
    ]);

    await clearTranslatedFiles(filePaths, ['es']);

    // Verify the es directory (and all contents) was deleted
    await expect(fs.access(path.join(testDir, 'snippets', 'es'))).rejects.toThrow();
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

    await clearTranslatedFiles(filePaths, ['es', 'fr', 'de']);

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

    await clearTranslatedFiles(filePaths, ['en-US', 'zh-CN']);

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

    await clearTranslatedFiles(filePaths, ['es', 'fr']);

    // Verify the directory was NOT deleted (no locale pattern found)
    await expect(fs.access(notLocaleDir)).resolves.toBeUndefined();
  });

  it('should handle already deleted directories gracefully', async () => {
    // Don't create the directory, just reference it

    const filePaths = new Set([
      path.join(testDir, 'snippets', 'es', 'file.mdx'),
    ]);

    // Should not throw an error
    await expect(clearTranslatedFiles(filePaths, ['es'])).resolves.toBeUndefined();
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

    await clearTranslatedFiles(filePaths, ['es']);

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

    await clearTranslatedFiles(filePaths, ['es']);

    // Should delete docs/v2/es and everything inside it
    const esDir = path.join(testDir, 'docs', 'v2', 'es');
    await expect(fs.access(esDir)).rejects.toThrow();

    // Parent directories should still exist
    await expect(fs.access(path.join(testDir, 'docs', 'v2'))).resolves.toBeUndefined();
  });
});
