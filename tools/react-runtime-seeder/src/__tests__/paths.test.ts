import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizePath, relativeToCwd } from '../paths';

describe('relativeToCwd', () => {
  it('preserves distinct nested paths with Windows separators', () => {
    const cwd = String.raw`C:\repo`;
    const first = relativeToCwd(
      cwd,
      String.raw`C:\repo\first\page.tsx`,
      path.win32
    );
    const second = relativeToCwd(
      cwd,
      String.raw`C:\repo\second\page.tsx`,
      path.win32
    );

    expect(normalizePath(first)).toBe('first/page.tsx');
    expect(normalizePath(second)).toBe('second/page.tsx');
  });

  it('uses the basename for files outside the working directory', () => {
    expect(
      relativeToCwd(
        String.raw`C:\repo`,
        String.raw`C:\elsewhere\page.tsx`,
        path.win32
      )
    ).toBe('page.tsx');
  });
});
