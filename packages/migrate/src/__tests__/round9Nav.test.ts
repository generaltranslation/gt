import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { clearI18nextConfigCache } from '../config/reactI18nextConfig.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MigrationContext } from '../pipeline/types.js';

// Round-9 review (Ernest, 2026-07-24), class C: the emitted navigation wrapper
// re-exported next/navigation's useRouter, so every programmatic
// push/replace/prefetch in a converted app silently lost next-intl's locale
// prefix (memo-engine: three call sites, no build error). Plus the deferred
// round-8 item: an i18next `ns` entry with no catalog file on disk.
//
// Every test here drives the REAL pipeline against a real tmpdir project;
// nothing hand-populates a MigrationContext.

function makeIO(): MigrateIO {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn((message: string) => {
      throw new Error(message);
    }) as unknown as (message: string) => never,
    guardGit: vi.fn(),
    promptConfirm: vi.fn(async () => true),
    promptText: vi.fn(async () => ''),
    promptLocale: vi.fn(async () => ''),
    promptLocaleList: vi.fn(async () => []),
  };
}

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
  clearI18nextConfigCache();
});

function writeTree(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-r9-nav-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

function migrate(cwd: string, from = 'next-intl'): Promise<MigrationContext> {
  return runMigration(
    {
      config: 'gt.config.json',
      from,
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    from,
    makeIO(),
    cwd
  );
}

const lines = (...parts: string[]) => parts.join('\n');

function editFor(ctx: MigrationContext, suffix: string): string | undefined {
  const edit = ctx.edits.find(
    (candidate) =>
      candidate.kind === 'write' &&
      candidate.path.endsWith(suffix.split('/').join(path.sep))
  );
  return edit?.content;
}

// ---------------------------------------------------------------------------
// The memo-engine shape: localePrefix 'always', plain-string pushes only, and
// no locale-aware call anywhere (so the wrapper converts instead of holding).
// ---------------------------------------------------------------------------

function routingFile(
  localePrefix: string,
  extra: { defaultLocale?: string; prelude?: string } = {}
): string {
  return lines(
    "import { defineRouting } from 'next-intl/routing';",
    extra.prelude ?? '',
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    `  defaultLocale: ${extra.defaultLocale ?? "'en'"},`,
    `  localePrefix: ${localePrefix},`,
    '});'
  );
}

const wrapperSource = lines(
  "import { createNavigation } from 'next-intl/navigation';",
  "import { routing } from './routing';",
  'export const { Link, redirect, usePathname, useRouter } =',
  '  createNavigation(routing);'
);

/**
 * A memo-engine-shaped app. `wrapperExtension` picks the navigation wrapper's
 * language: the emitted companion module follows it, and the '.js' emit is the
 * one the behavior tests below evaluate (no type annotations to strip).
 */
function nextIntlApp(
  options: {
    localePrefix?: string;
    defaultLocale?: string;
    prelude?: string;
    wrapperExtension?: 'ts' | 'js';
    destructured?: string;
    extraFiles?: Record<string, string>;
  } = {}
): string {
  const extension = options.wrapperExtension ?? 'ts';
  const wrapper = options.destructured
    ? wrapperSource.replace(
        '{ Link, redirect, usePathname, useRouter }',
        options.destructured
      )
    : wrapperSource;
  return writeTree({
    'package.json': JSON.stringify({
      name: 'memo-shaped',
      dependencies: {
        next: '15.5.0',
        'next-intl': '^4.1.0',
        react: '19.0.0',
      },
    }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } },
    }),
    'messages/en.json': JSON.stringify({ Home: { title: 'Deals' } }),
    'messages/es.json': JSON.stringify({ Home: { title: 'Operaciones' } }),
    'i18n/routing.ts': routingFile(options.localePrefix ?? "'always'", {
      defaultLocale: options.defaultLocale,
      prelude: options.prelude,
    }),
    [`i18n/navigation.${extension}`]: wrapper,
    'app/[locale]/layout.tsx': lines(
      'export default function LocaleLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return (',
      '    <html>',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}'
    ),
    'app/[locale]/page.tsx': lines(
      "import { useTranslations } from 'next-intl';",
      'export default function Home() {',
      "  const t = useTranslations('Home');",
      "  return <h1>{t('title')}</h1>;",
      '}'
    ),
    // Shape 1: a `const router = useRouter()` binding (sort-filter-bar.tsx:69).
    'components/sort-filter-bar.tsx': lines(
      "'use client';",
      "import { useRouter } from '@/i18n/navigation';",
      'export function SortFilterBar({ qs }: { qs: string }) {',
      '  const router = useRouter();',
      '  return (',
      '    <button onClick={() => router.replace(qs ? `/?${qs}` : `/`)}>',
      '      sort',
      '    </button>',
      '  );',
      '}'
    ),
    // Shape 2: a destructured method (w5 C.6).
    'components/folder-tree-item.tsx': lines(
      "'use client';",
      "import { useRouter } from '@/i18n/navigation';",
      'export function FolderTreeItem({ qs }: { qs: string }) {',
      '  const { push } = useRouter();',
      '  return <button onClick={() => push(`/?${qs}`)}>open</button>;',
      '}'
    ),
    // Shape 3: a chained useRouter().push reference (w5 C.6).
    'components/analysis-step.tsx': lines(
      "'use client';",
      "import { useRouter } from '@/i18n/navigation';",
      'export function AnalysisStep({ dealId }: { dealId: string }) {',
      '  const push = useRouter().push;',
      '  return (',
      '    <button onClick={() => push(`/deals/${dealId}/tear-sheet`)}>',
      '      tear sheet',
      '    </button>',
      '  );',
      '}'
    ),
    // Shape 4: a namespace import (w5 C.6).
    'components/quick-assign-menu.tsx': lines(
      "'use client';",
      "import * as nav from '@/i18n/navigation';",
      'export function QuickAssignMenu() {',
      '  const router = nav.useRouter();',
      '  return <button onClick={() => router.push(`/settings`)}>go</button>;',
      '}'
    ),
    ...options.extraFiles,
  });
}

type FakeRouter = {
  calls: [string, string][];
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => void;
  back: () => void;
  refresh: () => void;
};

function fakeRouter(): FakeRouter {
  const calls: [string, string][] = [];
  return {
    calls,
    push: (href: string) => calls.push(['push', href]),
    replace: (href: string) => calls.push(['replace', href]),
    prefetch: (href: string) => calls.push(['prefetch', href]),
    back: () => calls.push(['back', '']),
    refresh: () => calls.push(['refresh', '']),
  };
}

/**
 * Evaluates the emitted (JavaScript) companion module with fakes standing in
 * for next/navigation, gt-next and react, so the pinned behavior is the code
 * gt migrate actually writes rather than a restatement of it.
 */
function loadEmittedClientModule(
  content: string,
  locale: string,
  router: FakeRouter
): { useRouter: () => FakeRouter } {
  const body = content
    .replace(/^'use client';$/m, '')
    // The emitted imports are replaced by the injected fakes below.
    .replace(/^import[\s\S]*?from '[^']+';$/gm, '')
    .replace(/^export /gm, '');
  const factory = new Function(
    'useNextRouter',
    'useLocale',
    'useMemo',
    `${body}\nreturn { useRouter };`
  );
  return factory(
    () => router,
    () => locale,
    (compute: () => unknown) => compute()
  );
}

describe('round 9: locale-prefixing useRouter for converted next-intl wrappers', () => {
  it("routes useRouter through the generated wrapper under localePrefix 'always'", async () => {
    const cwd = await nextIntlApp();
    const ctx = await migrate(cwd);

    const wrapper = editFor(ctx, 'i18n/navigation.ts');
    expect(wrapper).toBeDefined();
    // useRouter is no longer a next/navigation passthrough...
    expect(wrapper).not.toMatch(
      /export \{[^}]*useRouter[^}]*\} from 'next\/navigation'/
    );
    // ...it comes from the companion client module, next to usePathname.
    expect(wrapper).toContain(
      "export { usePathname, useRouter } from './navigation.client';"
    );
    expect(wrapper).toContain("export { redirect } from 'next/navigation';");

    const client = editFor(ctx, 'i18n/navigation.client.ts');
    expect(client).toBeDefined();
    expect(client).toMatch(/^'use client';/);
    expect(client).toContain('export function useRouter()');
    expect(client).toContain("const LOCALES = ['en', 'es'];");
    // 'always' prefixes every locale, so no default-locale exemption.
    expect(client).not.toContain('DEFAULT_LOCALE');
    expect(client).toContain('function localizeHref(href: string');
    expect(client).toContain('...router,');
    expect(client).toContain('}, [router, locale]);');
    // prefetch's option type is PrefetchOptions (a required `kind`), not
    // push's NavigateOptions; one shared alias fails a strict app build.
    expect(client).toContain(
      'type NavigateOptions = Parameters<typeof router.push>[1];'
    );
    expect(client).toContain(
      'type PrefetchOptions = Parameters<typeof router.prefetch>[1];'
    );
  });

  it('leaves every call-site shape untouched at the source', async () => {
    const cwd = await nextIntlApp();
    const before = new Map(
      [
        'components/sort-filter-bar.tsx',
        'components/folder-tree-item.tsx',
        'components/analysis-step.tsx',
        'components/quick-assign-menu.tsx',
      ].map((rel) => [rel, fs.readFileSync(path.join(cwd, rel), 'utf8')])
    );
    const ctx = await migrate(cwd);
    for (const [rel, content] of before) {
      const edit = ctx.edits.find(
        (candidate) => candidate.path === path.join(cwd, rel)
      );
      // Either untouched, or rewritten to the identical bytes; both mean the
      // call site keeps its `@/i18n/navigation` import and its plain string
      // href, and the prefix arrives through the wrapper's export.
      expect(edit?.content ?? content).toBe(content);
      expect(ctx.skippedFiles.get(path.join(cwd, rel))).toBeUndefined();
    }
  });

  it("prefixes push/replace/prefetch and passes back/refresh through ('always')", async () => {
    const cwd = await nextIntlApp({ wrapperExtension: 'js' });
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.js');
    expect(client).toBeDefined();
    // No type annotations in a JS emit (it would not parse).
    expect(client).not.toContain(': string');

    const router = fakeRouter();
    const mod = loadEmittedClientModule(client!, 'es', router);
    const instance = mod.useRouter();
    instance.push('/deals/1/tear-sheet');
    instance.replace('/?sort=name');
    instance.prefetch('/deals');
    instance.back();
    instance.refresh();
    expect(router.calls).toEqual([
      ['push', '/es/deals/1/tear-sheet'],
      // next-intl's prefixPathname drops the lone slash of '/' and '/?query'
      // so the prefixed href never carries a trailing slash (verified against
      // next-intl 4.13.3's shared/utils.js).
      ['replace', '/es?sort=name'],
      ['prefetch', '/es/deals'],
      ['back', ''],
      ['refresh', ''],
    ]);
  });

  it("prefixes '/' without a trailing slash, like next-intl's prefixPathname", async () => {
    const cwd = await nextIntlApp({ wrapperExtension: 'js' });
    const ctx = await migrate(cwd);
    const router = fakeRouter();
    const instance = loadEmittedClientModule(
      editFor(ctx, 'i18n/navigation.client.js')!,
      'en',
      router
    ).useRouter();
    instance.replace('/');
    instance.replace('/?sort=name');
    expect(router.calls).toEqual([
      ['replace', '/en'],
      ['replace', '/en?sort=name'],
    ]);
  });

  it('never double-prefixes an href that already starts with a locale', async () => {
    const cwd = await nextIntlApp({ wrapperExtension: 'js' });
    const ctx = await migrate(cwd);
    const router = fakeRouter();
    const instance = loadEmittedClientModule(
      editFor(ctx, 'i18n/navigation.client.js')!,
      'en',
      router
    ).useRouter();
    instance.push('/en/deals');
    instance.push('/en');
    instance.push('/en?sort=name');
    // A configured locale other than the active one is equally already-scoped.
    instance.push('/es/deals');
    // A segment that merely starts with a locale is NOT a locale prefix.
    instance.push('/english/deals');
    expect(router.calls).toEqual([
      ['push', '/en/deals'],
      ['push', '/en'],
      ['push', '/en?sort=name'],
      ['push', '/es/deals'],
      ['push', '/en/english/deals'],
    ]);
  });

  it('leaves external, hash and relative hrefs alone', async () => {
    const cwd = await nextIntlApp({ wrapperExtension: 'js' });
    const ctx = await migrate(cwd);
    const router = fakeRouter();
    const instance = loadEmittedClientModule(
      editFor(ctx, 'i18n/navigation.client.js')!,
      'en',
      router
    ).useRouter();
    instance.push('https://example.com/deals');
    instance.push('mailto:sales@example.com');
    instance.push('#section');
    instance.push('deals/1');
    expect(router.calls).toEqual([
      ['push', 'https://example.com/deals'],
      ['push', 'mailto:sales@example.com'],
      ['push', '#section'],
      ['push', 'deals/1'],
    ]);
  });

  it('prefixes through destructured and chained call shapes too', async () => {
    const cwd = await nextIntlApp({ wrapperExtension: 'js' });
    const ctx = await migrate(cwd);
    const router = fakeRouter();
    const mod = loadEmittedClientModule(
      editFor(ctx, 'i18n/navigation.client.js')!,
      'es',
      router
    );
    // `const { push } = useRouter()` and `useRouter().push` are the two shapes
    // the detector could only see, never fix; going through the module's
    // export covers both.
    const { push } = mod.useRouter();
    push('/deals');
    mod.useRouter().replace('/settings');
    expect(router.calls).toEqual([
      ['push', '/es/deals'],
      ['replace', '/es/settings'],
    ]);
  });

  it("exempts only the default locale under localePrefix 'as-needed'", async () => {
    const cwd = await nextIntlApp({
      localePrefix: "'as-needed'",
      wrapperExtension: 'js',
    });
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.js');
    expect(client).toContain("const DEFAULT_LOCALE = 'en';");

    const defaultRouter = fakeRouter();
    loadEmittedClientModule(client!, 'en', defaultRouter)
      .useRouter()
      .push('/deals');
    expect(defaultRouter.calls).toEqual([['push', '/deals']]);

    const otherRouter = fakeRouter();
    loadEmittedClientModule(client!, 'es', otherRouter)
      .useRouter()
      .push('/deals');
    expect(otherRouter.calls).toEqual([['push', '/es/deals']]);
  });

  it("keeps the plain passthrough under localePrefix 'never'", async () => {
    const cwd = await nextIntlApp({ localePrefix: "'never'" });
    const ctx = await migrate(cwd);
    const wrapper = editFor(ctx, 'i18n/navigation.ts');
    expect(wrapper).toContain(
      "export { redirect, useRouter } from 'next/navigation';"
    );
    expect(wrapper).toContain(
      "export { usePathname } from './navigation.client';"
    );
    const client = editFor(ctx, 'i18n/navigation.client.ts');
    expect(client).not.toContain('useRouter');
    // Nothing was prefixed before, so nothing is reported as lost and the
    // wrapper carries a note rather than a TODO.
    expect(
      ctx.todos.filter((todo) => /locale-prefix|prefixed/.test(todo.reason))
    ).toEqual([]);
    expect(wrapper).not.toContain('TODO(gt-migrate)');
    expect(wrapper).toContain("// localePrefix 'never' prefixed no hrefs");
  });

  it('flags per-locale URL prefixes it cannot reproduce', async () => {
    const cwd = await nextIntlApp({
      localePrefix: "{ mode: 'always', prefixes: { es: '/esp' } }",
    });
    const ctx = await migrate(cwd);
    // Still converted (the middleware conversion drops the custom prefixes and
    // the app then serves /<locale>), but the mismatch is reported.
    expect(editFor(ctx, 'i18n/navigation.client.ts')).toContain(
      'export function useRouter()'
    );
    const todo = ctx.todos.find(
      (candidate) => candidate.file === path.join(cwd, 'i18n/navigation.ts')
    );
    expect(todo?.reason).toMatch(/localePrefix.prefixes/);
  });

  it('emits the companion module for a useRouter-only wrapper', async () => {
    const cwd = await nextIntlApp({ destructured: '{ Link, useRouter }' });
    const ctx = await migrate(cwd);
    const wrapper = editFor(ctx, 'i18n/navigation.ts');
    expect(wrapper).toContain(
      "export { useRouter } from './navigation.client';"
    );
    expect(wrapper).not.toContain("from 'next/navigation'");
    const client = editFor(ctx, 'i18n/navigation.client.ts');
    expect(client).toContain('export function useRouter()');
    expect(client).not.toContain('usePathname');
  });
});

// Round 9 F8 (R3): tags the emitted router could not inline as a plain string
// literal were filtered out of LOCALES with no TODO, warning or skip, and
// LOCALES is the whole input to the double-prefix guard: an href a call site
// already prefixed with a dropped locale got prefixed a second time. Nothing
// is narrowed silently now; a tag is escaped and inlined, or it is reported.
describe('round 9: the emitted LOCALES array is never narrowed silently', () => {
  /**
   * A memo-engine-shaped app whose routing config declares `locales`, with the
   * catalog file discovery insists on for each one (see catalogs/discover.ts:45).
   */
  function appWithLocales(
    locales: string[],
    options: { wrapperExtension?: 'ts' | 'js' } = {}
  ): string {
    const catalogs: Record<string, string> = {};
    for (const locale of locales) {
      catalogs[`messages/${locale}.json`] = JSON.stringify({
        Home: { title: locale },
      });
    }
    return nextIntlApp({
      ...options,
      extraFiles: {
        'i18n/routing.ts': lines(
          "import { defineRouting } from 'next-intl/routing';",
          'export const routing = defineRouting({',
          `  locales: ${JSON.stringify(locales)},`,
          "  defaultLocale: 'en',",
          "  localePrefix: 'always',",
          '});'
        ),
        ...catalogs,
      },
    });
  }

  it('inlines exotic-but-real tags rather than dropping them', async () => {
    const cwd = await appWithLocales(
      ['en', 'zh-Hans-CN', 'sr-Cyrl', 'ca-ES-valencia', 'en-US.UTF-8'],
      { wrapperExtension: 'js' }
    );
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.js');
    expect(client).toContain(
      "const LOCALES = ['en', 'zh-Hans-CN', 'sr-Cyrl', 'ca-ES-valencia', 'en-US.UTF-8'];"
    );

    const router = fakeRouter();
    const instance = loadEmittedClientModule(client!, 'en', router).useRouter();
    // Each configured locale is already-prefixed, including the dotted tag the
    // old inline-safety filter dropped (dropping it double-prefixed this href).
    instance.push('/zh-Hans-CN/deals');
    instance.push('/sr-Cyrl/deals');
    instance.push('/ca-ES-valencia/deals');
    instance.push('/en-US.UTF-8/deals');
    instance.push('/deals');
    expect(router.calls).toEqual([
      ['push', '/zh-Hans-CN/deals'],
      ['push', '/sr-Cyrl/deals'],
      ['push', '/ca-ES-valencia/deals'],
      ['push', '/en-US.UTF-8/deals'],
      ['push', '/en/deals'],
    ]);
  });

  it('escapes a tag that would otherwise break the emitted module', async () => {
    // The shape the old filter existed for: a quote (and a backslash) inside
    // the tag. Escaping keeps the guard complete AND the module parseable.
    const cwd = await appWithLocales(['en', "fr'x", 'de\\y'], {
      wrapperExtension: 'js',
    });
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.js');
    expect(client).toContain("const LOCALES = ['en', 'fr\\'x', 'de\\\\y'];");

    const router = fakeRouter();
    // new Function() throws on a syntax error, so this evaluating at all is the
    // "the emitted module still parses" assertion.
    const instance = loadEmittedClientModule(client!, 'en', router).useRouter();
    instance.push("/fr'x/deals");
    instance.push('/de\\y/deals');
    instance.push('/deals');
    expect(router.calls).toEqual([
      ['push', "/fr'x/deals"],
      ['push', '/de\\y/deals'],
      ['push', '/en/deals'],
    ]);
  });

  it('reports a tag that cannot be a URL segment instead of dropping it', async () => {
    // Reached through the catalog fallback (routing declares no `locales`, so
    // the catalog stems are the locale set): '#' ends a URL path segment, so
    // this tag can never equal one.
    const cwd = await nextIntlApp({
      extraFiles: {
        'i18n/routing.ts': lines(
          "import { defineRouting } from 'next-intl/routing';",
          'export const routing = defineRouting({',
          "  defaultLocale: 'en',",
          "  localePrefix: 'always',",
          '});'
        ),
        'messages/es#mx.json': JSON.stringify({ Home: { title: 'MX' } }),
      },
    });
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.ts');
    // Excluded for a reason that is about routing, not about syntax: an empty
    // tag would make LOCALES.includes('') true for '/' and switch prefixing
    // off entirely, and a tag holding '/' can never equal one segment.
    // The routable catalogs are still all there; only the tag that cannot be
    // a segment is out, and it is named in the module the reader will open.
    expect(client).toContain("const LOCALES = ['en', 'es'];");
    expect(client).toContain(
      '// TODO(gt-migrate): "es#mx" is a configured locale that cannot be'
    );
    const todo = ctx.todos.find((candidate) =>
      candidate.reason.includes('cannot be a URL path segment')
    );
    expect(todo?.file).toBe(path.join(cwd, 'i18n/navigation.ts'));
    expect(todo?.reason).toContain('"es#mx"');
    expect(todo?.reason).toContain('prefixed a second time');
  });

  it("escapes the 'as-needed' default locale it inlines too", async () => {
    const cwd = await nextIntlApp({
      localePrefix: "'as-needed'",
      defaultLocale: '"fr\'x"',
      wrapperExtension: 'js',
      extraFiles: {
        'i18n/routing.ts': lines(
          "import { defineRouting } from 'next-intl/routing';",
          'export const routing = defineRouting({',
          `  locales: ${JSON.stringify(["fr'x", 'es'])},`,
          '  defaultLocale: "fr\'x",',
          "  localePrefix: 'as-needed',",
          '});'
        ),
        "messages/fr'x.json": JSON.stringify({ Home: { title: 'FR' } }),
      },
    });
    const ctx = await migrate(cwd);
    const client = editFor(ctx, 'i18n/navigation.client.js');
    expect(client).toContain("const DEFAULT_LOCALE = 'fr\\'x';");

    const router = fakeRouter();
    const instance = loadEmittedClientModule(
      client!,
      "fr'x",
      router
    ).useRouter();
    // 'as-needed': the default locale is served unprefixed, every other one is
    // prefixed. Both branches read DEFAULT_LOCALE, so a broken literal here is
    // a module that does not parse.
    instance.push('/deals');
    const other = loadEmittedClientModule(client!, 'es', router).useRouter();
    other.push('/deals');
    expect(router.calls).toEqual([
      ['push', '/deals'],
      ['push', '/es/deals'],
    ]);
  });
});

describe('round 9: the locale-aware hold still wins', () => {
  it('holds the wrapper on next-intl when a caller uses { locale }', async () => {
    const cwd = await nextIntlApp({
      extraFiles: {
        // The sniply/plantpal/autohack LocaleSwitcher shape.
        'components/locale-switcher.tsx': lines(
          "'use client';",
          "import { usePathname, useRouter } from '@/i18n/navigation';",
          'export function LocaleSwitcher({ locale }: { locale: string }) {',
          '  const router = useRouter();',
          '  const pathname = usePathname();',
          '  return (',
          '    <button onClick={() => router.replace(pathname, { locale })}>',
          '      switch',
          '    </button>',
          '  );',
          '}'
        ),
      },
    });
    const ctx = await migrate(cwd);
    const wrapper = path.join(cwd, 'i18n/navigation.ts');
    expect(ctx.skippedFiles.get(wrapper)?.join(' ')).toMatch(
      /locale-aware signatures/
    );
    // Nothing is written for the wrapper or a companion module: the app keeps
    // next-intl navigation, which still understands { locale }.
    expect(ctx.edits.some((edit) => edit.path === wrapper)).toBe(false);
    expect(
      ctx.edits.some((edit) => edit.path.includes('navigation.client'))
    ).toBe(false);
  });
});

describe('round 9: unreadable routing holds the wrapper instead of guessing', () => {
  it('holds when localePrefix cannot be resolved statically', async () => {
    const cwd = await nextIntlApp({
      localePrefix: 'PREFIX',
      prelude: "const PREFIX = 'always' as const;",
    });
    const ctx = await migrate(cwd);
    const reasons = ctx.skippedFiles
      .get(path.join(cwd, 'i18n/navigation.ts'))
      ?.join(' ');
    expect(reasons).toMatch(/localePrefix could not be statically resolved/);
    expect(reasons).toMatch(/useRouter/);
    expect(ctx.edits.some((edit) => edit.path.includes('navigation'))).toBe(
      false
    );
  });

  it('still converts an unresolved-localePrefix wrapper without useRouter', async () => {
    const cwd = await nextIntlApp({
      localePrefix: 'PREFIX',
      prelude: "const PREFIX = 'always' as const;",
      destructured: '{ Link, usePathname }',
    });
    const ctx = await migrate(cwd);
    expect(
      ctx.skippedFiles.get(path.join(cwd, 'i18n/navigation.ts'))
    ).toBeUndefined();
    expect(editFor(ctx, 'i18n/navigation.ts')).toContain('gt-next/link');
  });

  it("holds 'as-needed' when defaultLocale cannot be resolved statically", async () => {
    const cwd = await nextIntlApp({
      localePrefix: "'as-needed'",
      defaultLocale: 'DEFAULT',
      prelude: "const DEFAULT = 'en';",
    });
    const ctx = await migrate(cwd);
    const reasons = ctx.skippedFiles
      .get(path.join(cwd, 'i18n/navigation.ts'))
      ?.join(' ');
    expect(reasons).toMatch(/defaultLocale could not be statically resolved/);
    expect(ctx.edits.some((edit) => edit.path.includes('navigation'))).toBe(
      false
    );
  });
});

describe('round 9: the redirect TODO names call sites', () => {
  const serverRedirect = lines(
    "import { redirect } from '@/i18n/navigation';",
    'export default function Dashboard() {',
    "  redirect('/login');",
    '}'
  );

  it('lists every wrapper-derived redirect call site with a line number', async () => {
    const cwd = await nextIntlApp({
      extraFiles: {
        'app/[locale]/dashboard/page.tsx': serverRedirect,
        // A relative specifier reaches the same wrapper.
        'lib/guard.ts': lines(
          "import { permanentRedirect } from '../i18n/navigation';",
          'export function guard(ok: boolean) {',
          "  if (!ok) permanentRedirect('/login');",
          '}'
        ),
        // next/navigation's redirect never prefixed anything: not a call site.
        'lib/plain.ts': lines(
          "import { redirect } from 'next/navigation';",
          'export function bounce() {',
          "  redirect('/en/login');",
          '}'
        ),
      },
    });
    const ctx = await migrate(cwd);
    const navTodos = ctx.todos.filter((todo) =>
      /converted navigation wrapper/.test(todo.reason)
    );
    expect(
      navTodos.map((todo) => `${path.relative(cwd, todo.file)}:${todo.line}`)
    ).toEqual([
      path.join('app', '[locale]', 'dashboard', 'page.tsx') + ':3',
      path.join('lib', 'guard.ts') + ':3',
    ]);
    expect(navTodos[0].reason).toMatch(/redirect\(\)/);
    expect(navTodos[1].reason).toMatch(/permanentRedirect\(\)/);
    // The old behavior: one generic entry filed against the wrapper itself.
    expect(
      ctx.todos.some(
        (todo) => todo.file === path.join(cwd, 'i18n/navigation.ts')
      )
    ).toBe(false);
    // The wrapper still carries the caveat in a comment, scoped to redirect.
    const wrapper = editFor(ctx, 'i18n/navigation.ts');
    expect(wrapper).toContain(
      '// TODO(gt-migrate): redirect is plain next/navigation now'
    );
    expect(wrapper).not.toContain('TODO(gt-migrate): redirect/useRouter');
  });

  it('files no redirect TODO when nothing imports it from the wrapper', async () => {
    // memo-engine's own shape: the wrapper exports redirect, no file uses it.
    const ctx = await migrate(await nextIntlApp());
    expect(
      ctx.todos.filter((todo) =>
        /converted navigation wrapper/.test(todo.reason)
      )
    ).toEqual([]);
  });

  it("files no redirect TODO under localePrefix 'never'", async () => {
    const cwd = await nextIntlApp({
      localePrefix: "'never'",
      extraFiles: { 'app/[locale]/dashboard/page.tsx': serverRedirect },
    });
    const ctx = await migrate(cwd);
    expect(
      ctx.todos.filter((todo) =>
        /converted navigation wrapper/.test(todo.reason)
      )
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Deferred round-8 item: an i18next `ns` entry with no catalog file. The
// supportedLngs equivalent (910c8827e) already refuses; this is the same stop
// for namespaces, before anything is written.
// ---------------------------------------------------------------------------

function reactI18nextApp(ns: string[], catalogs: string[]): string {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'i18next-shaped',
      dependencies: {
        next: '15.5.0',
        i18next: '^23.0.0',
        'react-i18next': '^14.0.0',
        react: '19.0.0',
      },
    }),
    'i18n.ts': lines(
      "import i18n from 'i18next';",
      "import { initReactI18next } from 'react-i18next';",
      'i18n.use(initReactI18next).init({',
      "  supportedLngs: ['en', 'es'],",
      "  fallbackLng: 'en',",
      `  ns: [${ns.map((name) => `'${name}'`).join(', ')}],`,
      "  defaultNS: 'common',",
      '});',
      'export default i18n;'
    ),
    'app/[locale]/layout.tsx': lines(
      'export default function LocaleLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return (',
      '    <html>',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}'
    ),
    'app/[locale]/page.tsx': lines(
      "'use client';",
      "import { useTranslation } from 'react-i18next';",
      'export default function Home() {',
      "  const { t } = useTranslation('common');",
      "  return <h1>{t('title')}</h1>;",
      '}'
    ),
  };
  for (const namespace of catalogs) {
    files[`public/locales/en/${namespace}.json`] = JSON.stringify({
      title: 'Deals',
    });
    files[`public/locales/es/${namespace}.json`] = JSON.stringify({
      title: 'Operaciones',
    });
  }
  return writeTree(files);
}

describe('round 9: react-i18next ns validated against the catalogs', () => {
  it('stops the run when a configured namespace has no catalog file', async () => {
    const cwd = reactI18nextApp(['common', 'missing'], ['common']);
    await expect(migrate(cwd, 'react-i18next')).rejects.toThrow(
      /namespaces with no catalog file/
    );
    // Nothing was written: the stop happens during discovery, before the emit
    // phase builds a single edit.
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'gt'))).toBe(false);
  });

  it('names the missing namespaces and what it found', async () => {
    const cwd = reactI18nextApp(
      ['common', 'missing', 'alsoMissing'],
      ['common']
    );
    await expect(migrate(cwd, 'react-i18next')).rejects.toThrow(
      /no catalog for missing, alsoMissing; found common/
    );
  });

  it('proceeds when every configured namespace has a catalog', async () => {
    const cwd = reactI18nextApp(['common', 'deals'], ['common', 'deals']);
    const ctx = await migrate(cwd, 'react-i18next');
    expect(ctx.catalogs.locales).toEqual(['en', 'es']);
    expect(ctx.edits.length).toBeGreaterThan(0);
  });
});
