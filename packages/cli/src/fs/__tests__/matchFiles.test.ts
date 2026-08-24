import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fg from 'fast-glob';
import { matchFiles } from '../matchFiles.js';

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

describe('matchFiles', () => {
  const originalSeparator = Object.getOwnPropertyDescriptor(path, 'sep')!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(path, 'sep', originalSeparator);
  });

  it('passes slash-separated patterns to fast-glob on Windows', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.win32.sep,
    });

    matchFiles('C:\\project', ['src\\**\\*.ts', 'tests/**/*.ts']);

    expect(fg.sync).toHaveBeenCalledWith(['src/**/*.ts', 'tests/**/*.ts'], {
      cwd: 'C:\\project',
      absolute: true,
      onlyFiles: true,
    });
  });

  it('preserves escaped glob characters on POSIX', () => {
    Object.defineProperty(path, 'sep', {
      ...originalSeparator,
      value: path.posix.sep,
    });

    matchFiles('/project', [
      'app/\\(marketing\\)/*.mdx',
      'src/\\[slug\\]/*.json',
    ]);

    expect(fg.sync).toHaveBeenCalledWith(
      ['app/\\(marketing\\)/*.mdx', 'src/\\[slug\\]/*.json'],
      {
        cwd: '/project',
        absolute: true,
        onlyFiles: true,
      }
    );
  });
});
