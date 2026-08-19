import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRelativePath } from '../findFilepath.js';

describe('getRelativePath', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    vi.restoreAllMocks();
  });

  it('uses Windows separators as path segment boundaries', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });
    vi.spyOn(path, 'relative').mockReturnValue('src\\components\\AccountMenu');

    expect(getRelativePath('ignored.tsx', 'ignored')).toBe(
      'src.components.accountmenu'
    );
  });

  it('preserves a literal POSIX backslash within a path segment', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.posix.sep,
    });
    vi.spyOn(path, 'relative').mockReturnValue('src/Account\\Menu');

    expect(getRelativePath('ignored.tsx', 'ignored')).toBe('src.account_menu');
  });
});
