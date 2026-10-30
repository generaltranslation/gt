import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { getRelative, getRelativePath } from '../findFilepath.js';
import { hashStringSync } from '../../utils/hash.js';

describe('getRelative', () => {
  it('returns POSIX forward-slash relative paths for files within the working directory', () => {
    const target = path.resolve('src/utils/file.ts');
    const relative = getRelative(target);
    expect(relative).toBe('src/utils/file.ts');
    expect(relative).not.toContain('\\');
  });

  it('normalizes backslashes to forward slashes when path.relative produces Windows-style separators', () => {
    // Simulate Windows path.relative output on any platform (including Linux CI)
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('nested\\sub\\file.json' as never);
    try {
      const relative = getRelative('C:\\project\\nested\\sub\\file.json');
      expect(relative).toBe('nested/sub/file.json');
    } finally {
      spy.mockRestore();
    }
  });

  it('produces identical cross-platform fileId hashes via getRelative', () => {
    const target = path.resolve('public/locales/en.json');
    const posixRelative = getRelative(target);
    expect(posixRelative).toBe('public/locales/en.json');

    // Simulate path.relative returning Windows-style backslashes for the same file
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('public\\locales\\en.json' as never);
    try {
      const simulatedWinRelative = getRelative(
        'C:\\project\\public\\locales\\en.json'
      );
      expect(simulatedWinRelative).toBe('public/locales/en.json');
      expect(simulatedWinRelative).toBe(posixRelative);
      expect(hashStringSync(simulatedWinRelative)).toBe(
        hashStringSync(posixRelative)
      );
    } finally {
      spy.mockRestore();
    }
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
    const result = getRelativePath('src\\components\\NavBar\\Menu.jsx', 'src');
    expect(result).toBe('components.navbar.menu');
  });
});
