import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  localePrefixHasCustomPrefixes,
  parseRoutingConfig,
} from '../parseRoutingConfig.js';
import { transformMiddlewareFile } from '../transformMiddleware.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const tmpDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-prefix-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

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

function defineRoutingFile(body: string): string {
  return [
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    body,
    '});',
  ].join('\n');
}

describe('transformMiddlewareFile prefixDefaultLocale mapping', () => {
  it('adds prefixDefaultLocale: true when localePrefix is absent (next-intl default is "always")', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: null })
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(result.code).toContain('export default createNextMiddleware(');
    expect(result.code).not.toContain('next-intl/middleware');
  });

  it("adds prefixDefaultLocale: true for explicit 'always'", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'always' })
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(result.todos).toEqual([]);
  });

  it("omits the option for 'as-needed' (gt-next default already matches)", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'as-needed' })
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('createNextMiddleware()');
    expect(result.code).not.toContain('prefixDefaultLocale');
    expect(result.todos).toEqual([]);
  });

  it("'never' skips the file so the retained middleware holds back teardown", () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({ localePrefix: 'never' })
    );
    // gt-next middleware would add locale prefixes 'never' apps deliberately
    // avoid, so the file is skipped whole: next-intl stays installed and the
    // untouched middleware keeps working until it is converted by hand.
    expect(result.code).toBeNull();
    expect(
      result.skipReasons.some((reason) => reason.includes("'never'"))
    ).toBe(true);
    expect(result.todos).toEqual([]);
  });

  it('composes prefixDefaultLocale with pathConfig', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({
        localePrefix: 'always',
        pathnames: { '/about': { en: '/about', es: '/acerca' } },
      })
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(result.code).toContain('pathConfig:');
    expect(result.code).toContain('/acerca');
  });

  it('composes prefixDefaultLocale with pathConfig for the default (absent) case', () => {
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext({
        localePrefix: null,
        pathnames: { '/about': { en: '/about', es: '/acerca' } },
      })
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(result.code).toContain('pathConfig:');
  });

  it('no-ops on an already-migrated file (real re-run safety)', () => {
    // A genuine re-run: the first migration already swapped the import to
    // gt-next/middleware and wrote createNextMiddleware with its options. The
    // file no longer contains 'next-intl/middleware', so the module-string
    // guard bails before any transform runs — no second migration, no duplicate
    // options. (next-intl's createMiddleware never carries a gt-next options
    // object itself, so this is the only shape a re-run can take.)
    const migrated = [
      "import { createNextMiddleware } from 'gt-next/middleware';",
      'export default createNextMiddleware({ prefixDefaultLocale: true });',
      'export const config = {',
      "  matcher: ['/((?!api|_next|.*\\\\..*).*)'],",
      '};',
    ].join('\n');
    const result = transformMiddlewareFile(
      'middleware.ts',
      migrated,
      makeContext({ localePrefix: 'always' })
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([]);
    expect(result.todos).toEqual([]);
  });
});

describe('object-form localePrefix with custom prefixes', () => {
  it("respects mode 'always' and adds a TODO for custom prefixes", () => {
    const cwd = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'always', prefixes: { 'en-US': '/us', 'es-ES': '/es' } },"
      ),
    });
    const routing = parseRoutingConfig(cwd);
    expect(routing.localePrefix).toBe('always');

    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext(routing)
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(
      result.todos.some((todo) => todo.reason.includes('localePrefix.prefixes'))
    ).toBe(true);
  });

  it("respects mode 'as-needed' with custom prefixes (option omitted, prefixes TODO added)", () => {
    const cwd = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'as-needed', prefixes: { 'en-US': '/us' } },"
      ),
    });
    const routing = parseRoutingConfig(cwd);
    expect(routing.localePrefix).toBe('as-needed');

    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext(routing)
    );
    expect(result.code).not.toContain('prefixDefaultLocale');
    expect(
      result.todos.some((todo) => todo.reason.includes('localePrefix.prefixes'))
    ).toBe(true);
  });

  it('does not add a prefixes TODO when the object form has no prefixes', () => {
    const cwd = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'as-needed' },"
      ),
    });
    const routing = parseRoutingConfig(cwd);
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext(routing)
    );
    expect(
      result.todos.some((todo) => todo.reason.includes('localePrefix.prefixes'))
    ).toBe(false);
  });

  it('adds the prefixes TODO when prefixes is a dynamic value (static mode)', () => {
    // A variable prefixes map resolves the mode fine but hides the per-locale
    // URL segments; the drop-TODO must still fire so they are not lost silently.
    const cwd = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'always', prefixes: customPrefixes },"
      ),
    });
    const routing = parseRoutingConfig(cwd);
    expect(routing.localePrefix).toBe('always');
    const result = transformMiddlewareFile(
      'middleware.ts',
      canonical,
      makeContext(routing)
    );
    expect(result.code).toContain('prefixDefaultLocale: true');
    expect(
      result.todos.some((todo) => todo.reason.includes('localePrefix.prefixes'))
    ).toBe(true);
  });
});

describe('localePrefixHasCustomPrefixes', () => {
  it('is true for a non-empty prefixes map', () => {
    const cwd = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'always', prefixes: { 'en-US': '/us' } },"
      ),
    });
    const routing = parseRoutingConfig(cwd);
    expect(localePrefixHasCustomPrefixes(routing.routingFile)).toBe(true);
  });

  it('is false for the string form, empty prefixes, and a missing file', () => {
    const stringForm = makeProject({
      'i18n/routing.ts': defineRoutingFile("  localePrefix: 'always',"),
    });
    const emptyPrefixes = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'always', prefixes: {} },"
      ),
    });
    expect(
      localePrefixHasCustomPrefixes(parseRoutingConfig(stringForm).routingFile)
    ).toBe(false);
    expect(
      localePrefixHasCustomPrefixes(
        parseRoutingConfig(emptyPrefixes).routingFile
      )
    ).toBe(false);
    expect(localePrefixHasCustomPrefixes(null)).toBe(false);
    expect(localePrefixHasCustomPrefixes('/does/not/exist.ts')).toBe(false);
  });

  it('is true for a dynamic (non-object) prefixes value', () => {
    // A variable prefixes map cannot be inspected, but its presence means
    // per-locale prefixes exist, so we conservatively report them.
    const dynamicPrefixes = makeProject({
      'i18n/routing.ts': defineRoutingFile(
        "  localePrefix: { mode: 'always', prefixes: someVar },"
      ),
    });
    expect(
      localePrefixHasCustomPrefixes(
        parseRoutingConfig(dynamicPrefixes).routingFile
      )
    ).toBe(true);
  });
});
