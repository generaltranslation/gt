import { describe, expect, it } from 'vitest';
import { transformNavigationFile } from '../transformNavigation.js';

const canonical = [
  "import { createNavigation } from 'next-intl/navigation';",
  "import { routing } from './routing';",
  'export const { Link, redirect, usePathname, useRouter } =',
  '  createNavigation(routing);',
].join('\n');

describe('transformNavigationFile', () => {
  it('rewrites the canonical navigation wrapper file', () => {
    const result = transformNavigationFile('src/i18n/navigation.ts', canonical);
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /export \{ default as Link \} from ["']gt-next\/link["']/
    );
    expect(result.code).toMatch(
      /export \{ redirect, usePathname, useRouter \} from ["']next\/navigation["']/
    );
    expect(result.code).not.toContain('createNavigation');
    expect(result.todos.some((todo) => todo.reason.includes('locale'))).toBe(
      true
    );
  });

  it('returns unchanged for files without createNavigation', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      'export const x = 1;'
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([]);
  });

  it('skips when getPathname is destructured', () => {
    const withGetPathname = canonical.replace(
      '{ Link, redirect, usePathname, useRouter }',
      '{ Link, getPathname }'
    );
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      withGetPathname
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('getPathname');
  });

  it('skips when the file contains extra logic', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical + '\nexport function helper() { return 1; }'
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('extra');
  });
});
