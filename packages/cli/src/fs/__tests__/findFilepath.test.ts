import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import {
  getPosixRelative,
  getRelative,
  getRelativePath,
} from '../findFilepath.js';
import { hashStringSync } from '../../utils/hash.js';

describe('getRelative', () => {
  it('returns platform-native relative paths for files within the working directory', () => {
    const target = path.resolve('src/utils/file.ts');
    const relative = getRelative(target);
    expect(relative).toBe(path.relative(process.cwd(), target));
  });

  it('preserves native Windows backslashes when path.relative produces Windows-style separators', () => {
    // Simulate Windows path.relative output on any platform (including Linux CI)
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('nested\\sub\\file.json' as never);
    try {
      const relative = getRelative('C:\\project\\nested\\sub\\file.json');
      expect(relative).toBe('nested\\sub\\file.json');
    } finally {
      spy.mockRestore();
    }
  });

  it('preserves existing Windows file identity hash inputs via getRelative', () => {
    // Legacy Windows lockfiles were keyed on hashes of native backslash paths.
    // getRelative preserves those inputs so existing lockfiles and translation edits are preserved.
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('public\\locales\\en.json' as never);
    try {
      const winRelative = getRelative('C:\\project\\public\\locales\\en.json');
      expect(winRelative).toBe('public\\locales\\en.json');
      expect(hashStringSync(winRelative)).toBe(
        '6e8fbd23f995cb654cba0ba79e7e426d3509d5ccfe7b340b3913192e84278e89'
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

describe('getPosixRelative', () => {
  it('returns POSIX forward-slash relative paths for files within the working directory', () => {
    const target = path.resolve('src/utils/file.ts');
    const relative = getPosixRelative(target);
    expect(relative).toBe('src/utils/file.ts');
    expect(relative).not.toContain('\\');
  });

  it('normalizes backslashes to forward slashes when path.relative produces Windows-style separators', () => {
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('nested\\sub\\file.json' as never);
    try {
      const relative = getPosixRelative('C:\\project\\nested\\sub\\file.json');
      expect(relative).toBe('nested/sub/file.json');
    } finally {
      spy.mockRestore();
    }
  });

  it('produces identical cross-platform POSIX paths', () => {
    const spy = vi
      .spyOn(path, 'relative')
      .mockReturnValueOnce('public\\locales\\en.json' as never);
    try {
      const simulatedWinRelative = getPosixRelative(
        'C:\\project\\public\\locales\\en.json'
      );
      expect(simulatedWinRelative).toBe('public/locales/en.json');
    } finally {
      spy.mockRestore();
    }
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
