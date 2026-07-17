import { describe, expect, it } from 'vitest';
import { transformMiddlewareFile } from '../transformMiddleware.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';

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

  it("localePrefix 'never' converts the file, omits the option, and records a todo", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'never' })
    );
    // 'never' has no gt-next equivalent: the import is still swapped so the file
    // builds, prefixDefaultLocale is omitted, and a TODO comment + report todo
    // flag the semantic gap (see prefixDefaultLocale.test.ts for full coverage).
    expect(result.code).not.toBeNull();
    expect(result.code).toContain('createNextMiddleware');
    expect(result.code).not.toContain('prefixDefaultLocale');
    expect(result.code).toContain('TODO(gt migrate)');
    expect(result.skipReasons).toEqual([]);
    expect(result.todos.some((todo) => todo.reason.includes('never'))).toBe(
      true
    );
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
});
