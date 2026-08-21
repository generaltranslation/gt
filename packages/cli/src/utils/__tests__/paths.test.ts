import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { toPosixPath } from '../paths.js';

describe('toPosixPath', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
  });

  it('normalizes Windows paths and glob patterns on Windows', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    expect(toPosixPath('C:\\project\\src\\**\\*.json')).toBe(
      'C:/project/src/**/*.json'
    );
  });

  it('preserves escaped glob characters on POSIX', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.posix.sep,
    });

    expect(toPosixPath('app/\\(marketing\\)/*.mdx')).toBe(
      'app/\\(marketing\\)/*.mdx'
    );
    expect(toPosixPath('src/\\[slug\\]/*.json')).toBe('src/\\[slug\\]/*.json');
  });
});
