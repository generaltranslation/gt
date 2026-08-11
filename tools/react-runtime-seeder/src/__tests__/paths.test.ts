import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isNodeModulesPath, normalizePath, relativeToCwd } from '../paths';

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

  it('preserves relative identity for files outside the working directory', () => {
    expect(
      normalizePath(
        relativeToCwd(
          String.raw`C:\repo`,
          String.raw`C:\elsewhere\page.tsx`,
          path.win32
        )
      )
    ).toBe('../elsewhere/page.tsx');
  });

  it('keeps same-named external files distinct', () => {
    const first = relativeToCwd('/repo', '/first/page.tsx', path.posix);
    const second = relativeToCwd('/repo', '/second/page.tsx', path.posix);

    expect(first).toBe('../first/page.tsx');
    expect(second).toBe('../second/page.tsx');
  });

  it('preserves absolute paths when Windows drives differ', () => {
    expect(
      relativeToCwd(
        String.raw`C:\repo`,
        String.raw`D:\elsewhere\page.tsx`,
        path.win32
      )
    ).toBe(String.raw`D:\elsewhere\page.tsx`);
  });
});

describe('isNodeModulesPath', () => {
  it('recognizes POSIX and Windows dependency paths', () => {
    expect(isNodeModulesPath('/repo/node_modules/pkg/index.js')).toBe(true);
    expect(
      isNodeModulesPath(String.raw`C:\repo\node_modules\pkg\index.js`)
    ).toBe(true);
    expect(isNodeModulesPath('/repo/node_modules-copy/index.js')).toBe(false);
  });
});
