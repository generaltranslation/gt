import { describe, expect, it } from 'vitest';
import { transformNavigationFile } from '../transformNavigation.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const canonical = [
  "import { createNavigation } from 'next-intl/navigation';",
  "import { routing } from './routing';",
  'export const { Link, redirect, usePathname, useRouter } =',
  '  createNavigation(routing);',
].join('\n');

function makeContext(
  pathnames: Record<string, unknown> | null = null
): MigrationContext {
  const routing: RoutingInfo = {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    localePrefix: null,
    pathnames,
    routingFile: null,
    requestFile: null,
  };
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

describe('transformNavigationFile', () => {
  it('rewrites the canonical navigation wrapper file', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /export \{ default as Link \} from ["']gt-next\/link["']/
    );
    expect(result.code).toMatch(
      /export \{ redirect, useRouter \} from ["']next\/navigation["']/
    );
    expect(result.code).not.toContain('createNavigation');
    expect(result.todos.some((todo) => todo.reason.includes('locale'))).toBe(
      true
    );
  });

  it('wraps usePathname to strip the locale prefix like next-intl', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // not a raw re-export — next/navigation's includes the prefix
    expect(result.code).not.toMatch(
      /export \{[^}]*usePathname[^}]*\} from ["']next\/navigation["']/
    );
    expect(result.code).toContain('export function usePathname()');
    expect(result.code).toContain('useNextPathname');
    expect(result.code).toMatch(/import \{ useLocale \} from ["']gt-next["']/);
    expect(result.code).toContain('pathname.slice(prefix.length)');
  });

  it('omits the programmatic-navigation TODO when nothing needs it', () => {
    const linkOnly = canonical.replace(
      '{ Link, redirect, usePathname, useRouter }',
      '{ Link, usePathname }'
    );
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      linkOnly,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.todos).toEqual([]);
    expect(result.code).not.toContain('TODO(gt-migrate)');
  });

  it('skips whole when the routing config defines localized pathnames', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      makeContext({ '/about': { en: '/about', fr: '/a-propos' } })
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('pathnames');
  });

  it('returns unchanged for files without createNavigation', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      'export const x = 1;',
      makeContext()
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
      withGetPathname,
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('getPathname');
  });

  it('skips when the file contains extra logic', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical + '\nexport function helper() { return 1; }',
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('extra');
  });
});
