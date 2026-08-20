import { describe, expect, it } from 'vitest';
import { transformMiddlewareFile } from '../transforms/transformMiddleware.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';

const MIDDLEWARE_BODY = [
  "import createMiddleware from 'next-intl/middleware';",
  "import { routing } from './i18n/routing';",
  'export default createMiddleware(routing);',
  'export const config = {',
  "  matcher: ['/((?!api|_next|.*\\\\..*).*)'],",
  '};',
].join('\n');

function makeContext(routing: Partial<RoutingInfo> = {}): MigrationContext {
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

describe('r10 finding 5: as-needed keeps /en live instead of redirecting', () => {
  it('warns and TODOs about the duplicate default-locale URLs', () => {
    const ctx = makeContext({ localePrefix: 'as-needed' });
    const result = transformMiddlewareFile(
      'middleware.ts',
      MIDDLEWARE_BODY,
      ctx
    );
    // The emitted code stays right: gt-next's default matches 'as-needed' on
    // what each URL serves. Only the redirect half has no equivalent.
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('createNextMiddleware()');
    const warnings = (result.warnings ?? []).join(' ');
    expect(warnings).toMatch(/as-needed/);
    expect(warnings).toMatch(/\/en/);
    const todo = result.todos.map((entry) => entry.reason).join(' ');
    expect(todo).toMatch(/redirect/i);
    expect(todo).toMatch(/canonical/i);
    // The remedy is both next.config rules: `/en` -> `/` plus `/en/:path+` ->
    // `/:path+` reproduces the baseline 307s, while a lone `/en/:path*` sends
    // the bare prefix to an empty Location.
    expect(todo).toContain('`/en` -> `/`');
    expect(todo).toContain('`/en/:path+` -> `/:path+`');
    expect(todo).not.toContain(':path*` in next.config');
  });

  it("raises nothing extra for 'always'", () => {
    const ctx = makeContext({ localePrefix: 'always' });
    const result = transformMiddlewareFile(
      'middleware.ts',
      MIDDLEWARE_BODY,
      ctx
    );
    expect(result.warnings ?? []).toEqual([]);
    expect(result.todos).toEqual([]);
  });
});
