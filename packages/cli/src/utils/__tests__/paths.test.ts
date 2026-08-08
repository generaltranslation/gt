import { describe, expect, it } from 'vitest';
import { toPosixPath } from '../paths.js';

describe('toPosixPath', () => {
  it('normalizes Windows paths and glob patterns', () => {
    expect(toPosixPath('C:\\project\\src\\**\\*.json')).toBe(
      'C:/project/src/**/*.json'
    );
  });

  it('preserves POSIX paths', () => {
    expect(toPosixPath('/project/src/**/*.json')).toBe(
      '/project/src/**/*.json'
    );
  });
});
