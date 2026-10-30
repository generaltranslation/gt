import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { getFileId, getRelative, getRelativePath } from '../findFilepath.js';
import { win32Platform } from '../paths.js';

describe('getRelative', () => {
  it('returns POSIX relative paths for files within the working directory', () => {
    const target = path.resolve('src/utils/file.ts');
    const relative = getRelative(target);
    expect(relative).toBe('src/utils/file.ts');
  });

  it('normalizes Windows backslashes to forward slashes', () => {
    const relative = getRelative(
      'C:\\project\\nested\\sub\\file.json',
      'C:\\project',
      win32Platform
    );
    expect(relative).toBe('nested/sub/file.json');
  });

  it('preserves existing Windows file identity hash inputs via getFileId', () => {
    const winFileId = getFileId(
      'C:\\project\\public\\locales\\en.json',
      'C:\\project',
      win32Platform
    );
    expect(winFileId).toBe(
      '6e8fbd23f995cb654cba0ba79e7e426d3509d5ccfe7b340b3913192e84278e89'
    );
  });

  it('handles root-level files without leading slashes', () => {
    const target = path.resolve('package.json');
    const relative = getRelative(target);
    expect(relative).toBe('package.json');
  });
});

describe('getRelativePath', () => {
  it('converts file paths into dot-separated lowercase identifiers without extensions', () => {
    const result = getRelativePath(
      path.resolve('src/components/Button/Index.tsx'),
      path.resolve('src')
    );
    expect(result).toBe('components.button.index');
  });

  it('handles Windows backslashes in getRelativePath', () => {
    // Explicitly simulate Windows path resolution so the test is deterministic on Linux CI
    const originalRelative = path.relative;
    const spy = vi
      .spyOn(path, 'relative')
      .mockImplementation((from, to) =>
        process.platform === 'win32'
          ? originalRelative(from, to)
          : path.win32.relative(from, to)
      );
    try {
      const result = getRelativePath(
        'src\\components\\NavBar\\Menu.jsx',
        'src'
      );
      expect(result).toBe('components.navbar.menu');
    } finally {
      spy.mockRestore();
    }
  });
});
