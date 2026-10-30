import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  fromWindowsSerializedPath,
  getFileId,
  getRelative,
  isSameFilePath,
  posixPlatform,
  win32Platform,
} from '../paths.js';
import { hashStringSync } from '../../utils/hash.js';

describe('paths: getRelative', () => {
  it('converts Windows backslash separators to POSIX forward slashes', () => {
    const rel = getRelative(
      'C:\\project\\src\\components\\Button.tsx',
      'C:\\project',
      win32Platform
    );
    expect(rel).toBe('src/components/Button.tsx');
  });

  it('preserves legitimate literal backslashes in filenames on POSIX platforms', () => {
    const rel = getRelative(
      '/project/src/components/weird\\name.tsx',
      '/project',
      posixPlatform
    );
    expect(rel).toBe('src/components/weird\\name.tsx');
  });

  it('normalizes current directory files cleanly without leading slashes', () => {
    const rel = getRelative('package.json');
    expect(rel).toBe('package.json');
  });
});

describe('paths: getFileId', () => {
  it('deterministically computes the exact legacy Windows file identity hash on any platform', () => {
    const winFileId = getFileId(
      'C:\\project\\public\\locales\\en.json',
      'C:\\project',
      win32Platform
    );
    // Legacy Windows lockfiles hashed native 'public\locales\en.json'
    expect(winFileId).toBe(
      '6e8fbd23f995cb654cba0ba79e7e426d3509d5ccfe7b340b3913192e84278e89'
    );
  });

  it('computes POSIX file identity hash on any platform', () => {
    const posixFileId = getFileId(
      '/project/public/locales/en.json',
      '/project',
      posixPlatform
    );
    expect(posixFileId).toBe(hashStringSync('public/locales/en.json'));
  });

  it('produces distinct hashes for Windows vs POSIX representations of the same relative path', () => {
    const winFileId = getFileId(
      'C:\\project\\public\\locales\\en.json',
      'C:\\project',
      win32Platform
    );
    const posixFileId = getFileId(
      '/project/public/locales/en.json',
      '/project',
      posixPlatform
    );
    expect(winFileId).not.toBe(posixFileId);
  });
});

describe('paths: fromWindowsSerializedPath', () => {
  it('converts backslashes in legacy lockfile paths to forward slashes', () => {
    expect(fromWindowsSerializedPath('public\\locales\\en.json')).toBe(
      'public/locales/en.json'
    );
  });

  it('strips drive letters if present in serialized paths', () => {
    expect(fromWindowsSerializedPath('C:\\project\\file.json')).toBe(
      'project/file.json'
    );
  });
});

describe('paths: isSameFilePath', () => {
  it('matches identical relative paths', () => {
    expect(isSameFilePath('src/index.ts', 'src/index.ts')).toBe(true);
  });

  it('matches relative paths with redundant ./ prefixes', () => {
    expect(isSameFilePath('./src/index.ts', 'src/index.ts')).toBe(true);
  });

  it('preserves valid file names starting with .. like ..config/file.ts without false root escape rejection', () => {
    expect(isSameFilePath('..config/file.ts', './..config/file.ts')).toBe(true);
  });

  it('rejects paths that truly escape the project root', () => {
    const cwd = process.cwd();
    const outsidePath = path.resolve(cwd, '../outside.ts');
    expect(isSameFilePath(outsidePath, 'outside.ts', { cwd })).toBe(false);
  });

  it('matches host absolute path with its relative counterpart', () => {
    const cwd = process.cwd();
    const absPath = path.resolve(cwd, 'package.json');
    expect(isSameFilePath(absPath, 'package.json', { cwd })).toBe(true);
  });

  it('fails safely when foreign absolute path has no foreignRoot provided', () => {
    // When running on Linux, C:\ foreign path without foreignRoot must fail safely
    expect(
      isSameFilePath('C:\\repo\\file.json', 'file.json', {
        foreignRoot: undefined,
      })
    ).toBe(false);
  });

  it('matches foreign Windows absolute path when explicit foreignRoot is provided', () => {
    expect(
      isSameFilePath('C:\\repo\\src\\file.json', 'src/file.json', {
        foreignRoot: 'C:\\repo',
      })
    ).toBe(true);
  });

  it('rejects relative paths that escape the project root', () => {
    expect(isSameFilePath('../outside.ts', 'outside.ts')).toBe(false);
    expect(isSameFilePath('sub/../../outside.ts', 'outside.ts')).toBe(false);
  });

  it('fails safely when foreign POSIX absolute path has no foreignRoot provided on Windows', () => {
    expect(
      isSameFilePath('/home/user/repo/file.json', 'file.json', {
        foreignRoot: undefined,
      })
    ).toBe(false);
  });

  it('matches foreign POSIX absolute path when explicit foreignRoot is provided', () => {
    expect(
      isSameFilePath('/home/user/repo/src/file.json', 'src/file.json', {
        foreignRoot: '/home/user/repo',
      })
    ).toBe(true);
  });

  it('rejects paths on different Windows drives when using foreignRoot', () => {
    expect(
      isSameFilePath('D:\\repo\\file.json', 'file.json', {
        foreignRoot: 'C:\\repo',
      })
    ).toBe(false);
  });

  it('handles UNC paths with foreignRoot', () => {
    expect(
      isSameFilePath(
        '\\\\server\\share\\repo\\src\\file.json',
        'src/file.json',
        {
          foreignRoot: '\\\\server\\share\\repo',
        }
      )
    ).toBe(true);
    expect(
      isSameFilePath(
        '\\\\other\\share\\repo\\src\\file.json',
        'src/file.json',
        {
          foreignRoot: '\\\\server\\share\\repo',
        }
      )
    ).toBe(false);
  });

  it('normalizes Windows drive letter case differences with foreignRoot', () => {
    expect(
      isSameFilePath('c:\\repo\\file.json', 'file.json', {
        foreignRoot: 'C:\\repo',
      })
    ).toBe(true);
  });
});
