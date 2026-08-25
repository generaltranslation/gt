import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePosixGlob, toPosixGlob, toPosixPath } from '../paths.js';

describe('toPosixPath', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    vi.restoreAllMocks();
  });

  it('normalizes concrete Windows paths', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    expect(toPosixPath('C:\\project\\src\\**\\*.json')).toBe(
      'C:/project/src/**/*.json'
    );
  });

  it('preserves literal backslashes in concrete POSIX paths', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.posix.sep,
    });

    expect(toPosixPath('src/literal\\name.json')).toBe(
      'src/literal\\name.json'
    );
  });
});

describe('toPosixGlob', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    vi.restoreAllMocks();
  });

  it('normalizes Windows separators without consuming glob escapes', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    expect(toPosixGlob('src\\**\\*.json')).toBe('src/**/*.json');
    expect(toPosixGlob('app/\\(marketing\\)/*.mdx')).toBe(
      'app/\\(marketing\\)/*.mdx'
    );
    expect(toPosixGlob('src/\\[slug\\]/*.json')).toBe('src/\\[slug\\]/*.json');
  });

  it('normalizes separators before ordinary extglob prefix characters', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    expect(toPosixGlob('src\\!important\\+vendor\\@scope\\*.ts')).toBe(
      'src/!important/+vendor/@scope/*.ts'
    );
    expect(toPosixGlob('src/\\@(draft|final)/*.ts')).toBe(
      'src/\\@(draft|final)/*.ts'
    );
  });

  it('preserves authored glob syntax on POSIX', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.posix.sep,
    });

    expect(toPosixGlob('app/\\(marketing\\)/*.mdx')).toBe(
      'app/\\(marketing\\)/*.mdx'
    );
  });
});

describe('resolvePosixGlob', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
    vi.restoreAllMocks();
  });

  it('resolves the cwd separately from an escaped Windows glob', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    expect(resolvePosixGlob('/project', 'app/\\(marketing\\)/*.mdx')).toBe(
      '/project/app/\\(marketing\\)/*.mdx'
    );
  });

  it('escapes glob syntax in a concrete Windows cwd', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });
    vi.spyOn(path, 'resolve').mockReturnValue('C:\\projects\\(team)');

    expect(resolvePosixGlob('.', 'src/*.json')).toBe(
      'C:/projects/\\(team\\)/src/*.json'
    );
  });
});
