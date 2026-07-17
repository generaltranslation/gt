import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emitGtFiles } from '../emitGtFiles.js';
import { buildReport } from '../report.js';
import { transformLayoutFile } from '../transformLayout.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';

const tmpDirs: string[] = [];

/**
 * Builds a tiny in-memory project on disk and a MigrationContext whose
 * projectFiles point at the written source files (so the [locale]-layout
 * discovery in emitGtFiles has something to scan).
 */
function makeProject(files: Record<string, string>): MigrationContext {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-static-'));
  tmpDirs.push(cwd);
  const projectFiles: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(abs)) projectFiles.push(abs);
  }
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: path.join(cwd, 'messages'),
  };
  return {
    cwd,
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    projectFiles,
  };
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const basePackageJson = JSON.stringify(
  {
    name: 'app',
    dependencies: { next: '16.0.0', 'next-intl': '^4.0.0', react: '19.0.0' },
  },
  null,
  2
);

const layoutSource = 'export default function Layout() { return null; }';

describe('emitGtFiles static-locale resolvers', () => {
  it('emits getLocale.ts + getRegion.ts (src/) when [locale] is the root layout', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));

    const getLocale = byPath.get(path.join(ctx.cwd, 'src/getLocale.ts'));
    expect(getLocale?.kind).toBe('write');
    expect(getLocale?.content).toContain(
      "import { locale } from 'next/root-params';"
    );
    expect(getLocale?.content).toContain('return await locale();');

    const getRegion = byPath.get(path.join(ctx.cwd, 'src/getRegion.ts'));
    expect(getRegion?.kind).toBe('write');
    expect(getRegion?.content).toContain(
      'export default async function getRegion()'
    );
    expect(getRegion?.content).toContain('return undefined;');

    // no unexpected TODOs about static rendering
    expect(
      ctx.todos.some((todo) => todo.reason.includes('static rendering'))
    ).toBe(false);
  });

  it('emits resolvers at the project root when there is no src/ dir', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    const byPath = new Map(edits.map((edit) => [edit.path, edit]));
    expect(byPath.has(path.join(ctx.cwd, 'getLocale.ts'))).toBe(true);
    expect(byPath.has(path.join(ctx.cwd, 'getRegion.ts'))).toBe(true);
    expect(byPath.has(path.join(ctx.cwd, 'src/getLocale.ts'))).toBe(false);
  });

  it('does NOT emit resolvers but files a TODO when a separate root layout exists', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/layout.tsx': layoutSource,
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(
      false
    );

    const todo = ctx.todos.find((entry) =>
      entry.reason.includes('static rendering not restored')
    );
    expect(todo).toBeDefined();
    expect(todo?.reason).toContain('root layout');
    expect(todo?.reason).toContain('next/root-params');
    expect(todo?.reason).toContain('Merge');
    expect(todo?.file).toBe(path.join(ctx.cwd, 'src/app/[locale]/layout.tsx'));
  });

  it('still emits when a nested layout sits below [locale] (not a root layout above)', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[locale]/layout.tsx': layoutSource,
      'src/app/[locale]/dashboard/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('src/getLocale.ts'))).toBe(
      true
    );
    expect(edits.some((edit) => edit.path.endsWith('src/getRegion.ts'))).toBe(
      true
    );
    expect(
      ctx.todos.some((todo) => todo.reason.includes('static rendering'))
    ).toBe(false);
  });

  it('does not clobber an existing getLocale.ts and still emits getRegion.ts', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[locale]/layout.tsx': layoutSource,
      'src/getLocale.ts': 'export default async function getLocale() {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    // existing getLocale.ts left untouched (no write edit for it)
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some(
        (todo) =>
          todo.file.endsWith('getLocale.ts') &&
          todo.reason.includes('already exists')
      )
    ).toBe(true);
    // getRegion.ts still gets emitted
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(true);
  });

  it('does not clobber an existing getRegion.ts', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[locale]/layout.tsx': layoutSource,
      'src/getRegion.ts': 'export default async function getRegion() {}',
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some(
        (todo) =>
          todo.file.endsWith('getRegion.ts') &&
          todo.reason.includes('already exists')
      )
    ).toBe(true);
    // getLocale.ts still gets emitted
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(true);
  });

  it('emits nothing when there is no [locale] layout at all', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some((todo) => todo.reason.includes('static rendering'))
    ).toBe(false);
  });

  it('uses the installed Next version (node_modules) over the declared range', () => {
    // Declares a wide floor (>=13) but the actually-installed Next is new, so
    // the resolvers should still emit — the installed version wins.
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: '>=13.0.0',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'node_modules/next/package.json': JSON.stringify({
        name: 'next',
        version: '15.5.2',
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('src/getLocale.ts'))).toBe(
      true
    );
    expect(edits.some((edit) => edit.path.endsWith('src/getRegion.ts'))).toBe(
      true
    );
    expect(
      ctx.todos.some((todo) => todo.reason.includes('static rendering'))
    ).toBe(false);
  });

  it('emits at exactly Next 15.5.0 (the next/root-params floor)', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'node_modules/next/package.json': JSON.stringify({
        name: 'next',
        version: '15.5.0',
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('src/getLocale.ts'))).toBe(
      true
    );
    expect(edits.some((edit) => edit.path.endsWith('src/getRegion.ts'))).toBe(
      true
    );
  });

  it('does NOT emit when the installed Next is < 15.5 and files a version TODO', () => {
    // A generous declared range would allow newer, but the installed Next is
    // old — the installed version wins and the import would break the build.
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: '^15.0.0',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'node_modules/next/package.json': JSON.stringify({
        name: 'next',
        version: '15.4.0',
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(
      false
    );

    const todo = ctx.todos.find((entry) =>
      entry.reason.includes('static rendering not restored')
    );
    expect(todo).toBeDefined();
    expect(todo?.reason).toContain('next/root-params');
    expect(todo?.reason).toContain('15.5');
    expect(todo?.reason).toContain('unstable_rootParams');
    expect(todo?.file).toBe(path.join(ctx.cwd, 'src/app/[locale]/layout.tsx'));
  });

  it('does NOT emit when no node_modules and the declared range is < 15.5', () => {
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: '15.4.0',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some((todo) =>
        todo.reason.includes('static rendering not restored')
      )
    ).toBe(true);
  });

  it('treats a wide declared range conservatively (>=13 does not emit)', () => {
    // Without an installed Next to pin the version, the lower bound (13.0.0)
    // governs — below the floor, so nothing is emitted.
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: '>=13.0.0',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(
      ctx.todos.some((todo) =>
        todo.reason.includes('static rendering not restored')
      )
    ).toBe(true);
  });

  it('does NOT emit when Next is undeterminable (unparseable range, no node_modules)', () => {
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: 'latest',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    const todo = ctx.todos.find((entry) =>
      entry.reason.includes('static rendering not restored')
    );
    expect(todo).toBeDefined();
    expect(todo?.reason).toContain('15.5');
  });

  it('files a segment-name TODO when the dynamic segment is not [locale]', () => {
    // App localizes on [lang], which next/root-params' locale() cannot resolve.
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[lang]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    const edits = emitGtFiles(ctx);
    expect(edits.some((edit) => edit.path.endsWith('getLocale.ts'))).toBe(
      false
    );
    expect(edits.some((edit) => edit.path.endsWith('getRegion.ts'))).toBe(
      false
    );

    const todo = ctx.todos.find((entry) =>
      entry.reason.includes('static rendering not restored')
    );
    expect(todo).toBeDefined();
    expect(todo?.reason).toContain('[locale]');
    expect(todo?.reason).toContain('next/root-params');
    expect(todo?.file).toBe(path.join(ctx.cwd, 'src/app/[lang]/layout.tsx'));
  });

  it('report lists the emitted resolvers and explains static preservation', () => {
    const ctx = makeProject({
      'package.json': basePackageJson,
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    ctx.edits.push(...emitGtFiles(ctx));
    const report = buildReport(ctx, false);
    expect(report).toContain('Static rendering preserved');
    expect(report).toContain('src/getLocale.ts');
    expect(report).toContain('src/getRegion.ts');
    expect(report).toContain('next/root-params');
  });

  it('report does NOT claim static rendering preserved on an old Next; it lists the TODO', () => {
    const ctx = makeProject({
      'package.json': JSON.stringify({
        name: 'app',
        dependencies: {
          next: '15.4.0',
          'next-intl': '^4.0.0',
          react: '19.0.0',
        },
      }),
      'src/app/[locale]/layout.tsx': layoutSource,
      'messages/en.json': '{}',
    });
    ctx.edits.push(...emitGtFiles(ctx));
    const report = buildReport(ctx, false);
    expect(report).not.toContain('Static rendering preserved');
    expect(report).toContain('static rendering not restored');
    expect(report).toContain('unstable_rootParams');
  });
});

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeLayoutContext(skipped: string[] = []): MigrationContext {
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
    skippedFiles: new Map(skipped.map((file) => [file, ['reason']])),
    stats: {},
  };
}

describe('transformLayoutFile static locale', () => {
  it('keeps <html lang> on the route param instead of getLocale()', () => {
    const source = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages, setRequestLocale } from 'next-intl/server';",
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  setRequestLocale(locale);',
      '  const messages = await getMessages();',
      '  return (',
      '    <html lang={locale}>',
      '      <body>',
      '        <NextIntlClientProvider messages={messages}>',
      '          {children}',
      '        </NextIntlClientProvider>',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      source,
      makeLayoutContext()
    );
    expect(result.skipReasons).toEqual([]);
    // param-driven lang (static), never a request-scoped getLocale()
    expect(result.code).toContain('lang={locale}');
    expect(result.code).not.toContain('getLocale()');
    // the destructure that feeds lang is retained
    expect(result.code).toContain('const { locale } = await params');
    // guard still removed
    expect(result.code).not.toContain('hasLocale');
  });

  it('feeds a retained provider the static param locale (no request-scoped getLocale)', () => {
    const source = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages, setRequestLocale } from 'next-intl/server';",
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  setRequestLocale(locale);',
      '  const messages = await getMessages();',
      '  return (',
      '    <html lang={locale}>',
      '      <body>',
      '        <NextIntlClientProvider messages={messages}>',
      '          {children}',
      '        </NextIntlClientProvider>',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    // A skipped file forces partial mode: the provider is retained and must be
    // fed a locale. It should reuse the static route-param binding (SSG-safe),
    // never a request-scoped getLocale() that would force dynamic rendering.
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      source,
      makeLayoutContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('NextIntlClientProvider');
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{locale\}/
    );
    expect(result.code).not.toContain('getLocale()');
    expect(result.code).toContain('lang={locale}');
    expect(result.code).toContain('const { locale } = await params');
  });
});
