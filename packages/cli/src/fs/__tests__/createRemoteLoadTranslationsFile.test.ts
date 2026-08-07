import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { createRemoteLoadTranslationsFile } from '../createRemoteLoadTranslationsFile.js';

describe('createRemoteLoadTranslationsFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cdn-loader-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a Vite-compatible CDN loader next to Vue source files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const filePath = await createRemoteLoadTranslationsFile(tmpDir);
    const content = fs.readFileSync(filePath, 'utf8');

    expect(filePath).toBe(path.join(tmpDir, 'src', 'loadTranslations.js'));
    expect(content).toContain(
      'const projectId = import.meta.env.VITE_GT_PROJECT_ID'
    );
    expect(content).toContain(JSON.stringify(defaultCacheUrl));
    expect(content).toContain(
      '`${cacheUrl}/${projectId}/${encodeURIComponent(locale)}`'
    );
    expect(content).toContain('return response.json()');
  });

  it('does not overwrite an application-owned loader', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    fs.writeFileSync(filePath, '// custom loader');

    await createRemoteLoadTranslationsFile(tmpDir);

    expect(fs.readFileSync(filePath, 'utf8')).toBe('// custom loader');
  });

  it('rejects a symbolic-link source directory', async () => {
    const outsideDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-vue-cdn-loader-outside-')
    );
    fs.symlinkSync(outsideDirectory, path.join(tmpDir, 'src'));

    try {
      await expect(createRemoteLoadTranslationsFile(tmpDir)).rejects.toThrow(
        /source directory.*symbolic link/i
      );
      expect(
        fs.existsSync(path.join(outsideDirectory, 'loadTranslations.js'))
      ).toBe(false);
    } finally {
      fs.rmSync(outsideDirectory, { recursive: true, force: true });
    }
  });

  it('rejects a symbolic-link loader instead of accepting its target', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const outsideFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cdn-loader-outside-')),
      'loadTranslations.js'
    );
    fs.writeFileSync(outsideFile, '// outside');
    fs.symlinkSync(
      outsideFile,
      path.join(tmpDir, 'src', 'loadTranslations.js')
    );

    try {
      await expect(createRemoteLoadTranslationsFile(tmpDir)).rejects.toThrow(
        /loader file.*symbolic link/i
      );
      expect(fs.readFileSync(outsideFile, 'utf8')).toBe('// outside');
    } finally {
      fs.rmSync(path.dirname(outsideFile), { recursive: true, force: true });
    }
  });

  it('rejects non-directory source and non-file loader paths', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src'), 'not a directory');
    await expect(createRemoteLoadTranslationsFile(tmpDir)).rejects.toThrow(
      /source path.*not a directory/i
    );

    fs.rmSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'loadTranslations.js'), {
      recursive: true,
    });
    await expect(createRemoteLoadTranslationsFile(tmpDir)).rejects.toThrow(
      /loader path.*not a file/i
    );
  });

  it('does not clobber a loader created at the publication boundary', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    const link = fs.promises.link.bind(fs.promises);
    vi.spyOn(fs.promises, 'link').mockImplementationOnce(
      async (temporaryPath, targetPath) => {
        fs.writeFileSync(targetPath, '// application loader');
        return link(temporaryPath, targetPath);
      }
    );

    await createRemoteLoadTranslationsFile(tmpDir);

    expect(fs.readFileSync(filePath, 'utf8')).toBe('// application loader');
    expect(fs.readdirSync(path.dirname(filePath))).toEqual([
      'loadTranslations.js',
    ]);
  });

  it('leaves no final or temporary file when publication fails', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    vi.spyOn(fs.promises, 'link').mockRejectedValueOnce(
      Object.assign(new Error('link failed'), { code: 'EIO' })
    );

    await expect(createRemoteLoadTranslationsFile(tmpDir)).rejects.toThrow(
      'link failed'
    );

    expect(fs.existsSync(filePath)).toBe(false);
    expect(fs.readdirSync(path.dirname(filePath))).toEqual([]);
  });

  it('supports concurrent setup without producing a partial loader', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const paths = await Promise.all([
      createRemoteLoadTranslationsFile(tmpDir),
      createRemoteLoadTranslationsFile(tmpDir),
      createRemoteLoadTranslationsFile(tmpDir),
    ]);

    expect(new Set(paths)).toEqual(
      new Set([path.join(tmpDir, 'src', 'loadTranslations.js')])
    );
    expect(fs.readdirSync(path.join(tmpDir, 'src'))).toEqual([
      'loadTranslations.js',
    ]);
    expect(fs.readFileSync(paths[0], 'utf8')).toContain(
      'export default async function loadTranslations(locale)'
    );
  });
});
