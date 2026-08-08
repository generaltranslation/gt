import { beforeEach, describe, expect, it, vi } from 'vitest';
import fg from 'fast-glob';
import { matchFiles } from '../matchFiles.js';

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

describe('matchFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes slash-separated patterns to fast-glob', () => {
    matchFiles('C:\\project', ['src\\**\\*.ts', 'tests/**/*.ts']);

    expect(fg.sync).toHaveBeenCalledWith(['src/**/*.ts', 'tests/**/*.ts'], {
      cwd: 'C:\\project',
      absolute: true,
      onlyFiles: true,
    });
  });
});
