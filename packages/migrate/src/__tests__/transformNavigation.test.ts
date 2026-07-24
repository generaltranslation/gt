import { describe, expect, it } from 'vitest';
import { transformNavigationFile } from '../transforms/transformNavigation.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const canonical = [
  "import { createNavigation } from 'next-intl/navigation';",
  "import { routing } from './routing';",
  'export const { Link, redirect, usePathname, useRouter } =',
  '  createNavigation(routing);',
].join('\n');

function makeContext(
  pathnames: Record<string, unknown> | null = null,
  pathnamesUnresolved = false
): MigrationContext {
  const routing: RoutingInfo = {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    localePrefix: null,
    pathnames,
    pathnamesUnresolved,
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
      // typed re-export: gt-next/link ships ForwardRefExoticComponent<any>,
      // so TS wrappers re-export under next/link's concrete type
      /export const Link = GTLink as unknown as typeof NextLink;/
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
    const ctx = makeContext();
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    // not a raw re-export; next/navigation's includes the prefix
    expect(result.code).not.toMatch(
      /export \{[^}]*usePathname[^}]*\} from ["']next\/navigation["']/
    );
    // The hook body lives in a companion 'use client' module: the wrapper is
    // also imported by Server Components (a server page importing Link), and
    // a directive-less module with hook imports fails the RSC build.
    expect(result.code).toContain(
      "export { usePathname } from './navigation.client'"
    );
    expect(result.code).not.toContain('useNextPathname');
    const clientEdit = ctx.edits.find((edit) =>
      edit.path.endsWith('navigation.client.ts')
    );
    expect(clientEdit).toBeDefined();
    expect(clientEdit!.content).toMatch(/^'use client';/);
    expect(clientEdit!.content).toContain('export function usePathname()');
    expect(clientEdit!.content).toContain('useNextPathname');
    expect(clientEdit!.content).toMatch(
      /import \{ useLocale \} from ["']gt-next["']/
    );
    expect(clientEdit!.content).toContain('pathname.slice(prefix.length)');
  });

  it('holds the wrapper when the companion client module name is taken', () => {
    const ctx = makeContext();
    ctx.edits.push({
      path: 'src/i18n/navigation.client.ts',
      kind: 'write',
      content: 'existing',
    });
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      ctx
    );
    expect(result.code).toBeNull();
    expect(
      result.skipReasons.some((reason) =>
        reason.includes('navigation.client.ts')
      )
    ).toBe(true);
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

  it('skips (not silently) when createNavigation is bound to an identifier', () => {
    const identifierBinding = [
      "import { createNavigation } from 'next-intl/navigation';",
      "import { routing } from './routing';",
      'const navigation = createNavigation(routing);',
      'export default navigation;',
    ].join('\n');
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      identifierBinding,
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.length).toBeGreaterThan(0);
    expect(result.skipReasons.join(' ')).toContain('unrecognized shape');
  });

  it('skips when createNavigation is default-exported directly', () => {
    const defaultExport = [
      "import { createNavigation } from 'next-intl/navigation';",
      "import { routing } from './routing';",
      'export default createNavigation(routing);',
    ].join('\n');
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      defaultExport,
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.length).toBeGreaterThan(0);
  });

  it('returns the none result when createNavigation is only a comment mention', () => {
    const commentOnly = [
      '// createNavigation from next-intl is not used in this file',
      'export const x = 1;',
    ].join('\n');
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      commentOnly,
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([]);
  });

  it('transforms an aliased createNavigation import', () => {
    const aliased = [
      "import { createNavigation as makeNav } from 'next-intl/navigation';",
      "import { routing } from './routing';",
      'export const { Link, redirect, usePathname, useRouter } =',
      '  makeNav(routing);',
    ].join('\n');
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      aliased,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      // typed re-export: gt-next/link ships ForwardRefExoticComponent<any>,
      // so TS wrappers re-export under next/link's concrete type
      /export const Link = GTLink as unknown as typeof NextLink;/
    );
    expect(result.code).not.toContain('createNavigation');
  });

  it('skips when routing pathnames could not be statically resolved', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      canonical,
      makeContext(null, true)
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('pathnames');
    expect(result.skipReasons.join(' ')).toContain('could not be');
    expect(result.skipReasons.join(' ')).toContain('resolved');
  });
});
