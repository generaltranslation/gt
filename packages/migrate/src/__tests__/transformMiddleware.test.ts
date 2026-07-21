import { describe, expect, it } from 'vitest';
import { transformMiddlewareFile } from '../transformMiddleware.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

function makeContext(routing: Partial<RoutingInfo>): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
      ...routing,
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

const canonical = [
  "import createMiddleware from 'next-intl/middleware';",
  "import { routing } from './i18n/routing';",
  'export default createMiddleware(routing);',
  'export const config = {',
  "  matcher: ['/((?!api|_next|.*\\\\..*).*)'],",
  '};',
].join('\n');

describe('transformMiddlewareFile', () => {
  it('swaps createMiddleware for createNextMiddleware and keeps the matcher', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({})
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /import \{ createNextMiddleware \} from ["']gt-next\/middleware["']/
    );
    expect(result.code).toContain('export default createNextMiddleware(');
    expect(result.code).toContain('matcher:');
    expect(result.code).not.toContain('next-intl/middleware');
  });

  it("maps localePrefix 'always' to prefixDefaultLocale: true", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'always' })
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
  });

  it('passes pathnames through as pathConfig', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({
        pathnames: { '/about': { en: '/about', es: '/acerca' } },
      })
    );
    expect(result.code).toContain('pathConfig:');
    expect(result.code).toContain('/acerca');
  });

  it("localePrefix 'never' skips the file so teardown is held back", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'never' })
    );
    expect(result.code).toBeNull();
    // A skip (not a todo): the file still imports next-intl/middleware,
    // and only skippedFiles blocks the teardown from uninstalling next-intl.
    expect(
      result.skipReasons.some((reason) => reason.includes("'never'"))
    ).toBe(true);
    expect(result.todos).toEqual([]);
  });

  it('skips middleware files with extra logic', () => {
    const withAuth = canonical.replace(
      'export default createMiddleware(routing);',
      [
        'const intl = createMiddleware(routing);',
        'export default function middleware(req) {',
        '  if (req.nextUrl.pathname.startsWith("/admin")) return auth(req);',
        '  return intl(req);',
        '}',
      ].join('\n')
    );
    const result = transformMiddlewareFile(
      'middleware.ts',
      withAuth,
      makeContext({})
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('extra');
  });

  it('skips the file when localePrefix could not be statically resolved', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefixUnresolved: true })
    );
    expect(result.code).toBeNull();
    expect(
      result.skipReasons.some((reason) => reason.includes('localePrefix'))
    ).toBe(true);
    expect(result.todos).toEqual([]);
  });

  it('skips the file when pathnames could not be statically resolved', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ pathnamesUnresolved: true })
    );
    expect(result.code).toBeNull();
    expect(
      result.skipReasons.some((reason) => reason.includes('pathnames'))
    ).toBe(true);
  });

  it('still converts resolved localePrefix contexts as before', () => {
    const always = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'always' })
    );
    expect(always.skipReasons).toEqual([]);
    expect(always.code).toContain('prefixDefaultLocale: true');

    const asNeeded = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'as-needed' })
    );
    expect(asNeeded.skipReasons).toEqual([]);
    expect(asNeeded.code).toContain('export default createNextMiddleware(');
    expect(asNeeded.code).not.toContain('prefixDefaultLocale');
  });
});
