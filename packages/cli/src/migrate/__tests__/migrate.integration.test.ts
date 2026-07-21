import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMigrateCommand } from '../../cli/commands/migrate.js';
import { installPackage } from '../../utils/installPackage.js';

vi.mock('../../hooks/postProcess.js', () => ({
  formatFiles: vi.fn(async () => {}),
  detectFormatter: vi.fn(async () => null),
}));

vi.mock('../../utils/installPackage.js', () => ({
  installPackage: vi.fn(async () => {}),
}));

vi.mock('../../utils/packageManager.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPackageManager: vi.fn(async () => ({
    id: 'npm',
    name: 'npm',
    label: 'npm',
    installCommand: 'install',
    devDependencyFlag: '--save-dev',
  })),
}));

const tmpDirs: string[] = [];

function makeApp(overrides: Record<string, string> = {}): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-app-'));
  tmpDirs.push(cwd);
  const files: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name: 'demo',
        dependencies: {
          // >= 15.5 so the static-locale resolvers (next/root-params) emit;
          // gated in emitGtFiles because next/root-params needs Next >= 15.5.
          next: '15.5.0',
          'next-intl': '^4.1.0',
          react: '19.0.0',
        },
      },
      null,
      2
    ),
    'next.config.ts': [
      "import createNextIntlPlugin from 'next-intl/plugin';",
      'const withNextIntl = createNextIntlPlugin();',
      'const nextConfig = { reactStrictMode: true };',
      'export default withNextIntl(nextConfig);',
    ].join('\n'),
    'middleware.ts': [
      "import createMiddleware from 'next-intl/middleware';",
      "import { routing } from './src/i18n/routing';",
      'export default createMiddleware(routing);',
      "export const config = { matcher: ['/((?!api|_next|.*\\\\..*).*)'] };",
    ].join('\n'),
    'src/i18n/routing.ts': [
      "import { defineRouting } from 'next-intl/routing';",
      'export const routing = defineRouting({',
      "  locales: ['en', 'es'],",
      "  defaultLocale: 'en',",
      '});',
    ].join('\n'),
    'src/i18n/request.ts': [
      "import { getRequestConfig } from 'next-intl/server';",
      "import { routing } from './routing';",
      'export default getRequestConfig(async ({ requestLocale }) => {',
      '  const locale = (await requestLocale) ?? routing.defaultLocale;',
      '  return {',
      '    locale,',
      '    messages: (await import(`../../messages/${locale}.json`)).default,',
      '  };',
      '});',
    ].join('\n'),
    'src/i18n/navigation.ts': [
      "import { createNavigation } from 'next-intl/navigation';",
      "import { routing } from './routing';",
      'export const { Link, redirect, usePathname, useRouter } =',
      '  createNavigation(routing);',
    ].join('\n'),
    'messages/en.json': JSON.stringify({
      Home: {
        title: 'Welcome to demo',
        greeting: 'Hello, {name}!',
        items: '{count, plural, one {# item} other {# items}}',
        terms: 'I accept the <b>terms</b>',
        hint: 'Enter your email',
      },
    }),
    'messages/es.json': JSON.stringify({
      Home: {
        title: 'Bienvenido a demo',
        greeting: '¡Hola, {name}!',
        items: '{count, plural, one {# artículo} other {# artículos}}',
        terms: 'Acepto los <b>términos</b>',
        hint: 'Escribe tu correo',
      },
    }),
    'src/app/[locale]/layout.tsx': [
      "import { NextIntlClientProvider, hasLocale } from 'next-intl';",
      "import { setRequestLocale } from 'next-intl/server';",
      "import { notFound } from 'next/navigation';",
      "import { routing } from '@/i18n/routing';",
      'export function generateStaticParams() {',
      '  return routing.locales.map((locale) => ({ locale }));',
      '}',
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
      '  return (',
      '    <html lang={locale}>',
      '      <body>',
      '        <NextIntlClientProvider>{children}</NextIntlClientProvider>',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n'),
    'src/app/[locale]/page.tsx': [
      "import { useTranslations } from 'next-intl';",
      'export default function Home() {',
      "  const t = useTranslations('Home');",
      '  return (',
      '    <main>',
      "      <h1>{t('title')}</h1>",
      "      <p>{t('greeting', { name: 'Ada' })}</p>",
      "      <p>{t('items', { count: 3 })}</p>",
      "      <input placeholder={t('hint')} />",
      '    </main>',
      '  );',
      '}',
    ].join('\n'),
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const read = (cwd: string, rel: string) =>
  fs.readFileSync(path.join(cwd, rel), 'utf8');

// App shape where the NextIntlClientProvider lives in a separate client file
// (a very common layout) rather than inline in the layout. The layout renders
// <Providers> and owns no provider of its own.
const SEPARATE_PROVIDER_FILES: Record<string, string> = {
  'src/app/[locale]/layout.tsx': [
    "import { hasLocale } from 'next-intl';",
    "import { setRequestLocale } from 'next-intl/server';",
    "import { notFound } from 'next/navigation';",
    "import { routing } from '@/i18n/routing';",
    "import { Providers } from '@/components/Providers';",
    'export function generateStaticParams() {',
    '  return routing.locales.map((locale) => ({ locale }));',
    '}',
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
    '  return (',
    '    <html lang={locale}>',
    '      <body>',
    '        <Providers>{children}</Providers>',
    '      </body>',
    '    </html>',
    '  );',
    '}',
  ].join('\n'),
  'src/components/Providers.tsx': [
    "'use client';",
    "import { NextIntlClientProvider, useMessages } from 'next-intl';",
    'export function Providers({ children }: { children: React.ReactNode }) {',
    '  const messages = useMessages();',
    '  return (',
    '    <NextIntlClientProvider messages={messages}>',
    '      {children}',
    '    </NextIntlClientProvider>',
    '  );',
    '}',
  ].join('\n'),
};

describe('handleMigrateCommand integration', () => {
  it('migrates the fixture app end to end', async () => {
    const cwd = makeApp();
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // page: hooks swapped, dictionary calls intact
    const page = read(cwd, 'src/app/[locale]/page.tsx');
    expect(page).toMatch(/import \{.*useTranslations.*\} from ["']gt-next["']/);
    expect(page).toContain("t('greeting', { name: 'Ada' })");
    expect(page).toContain("t('items', { count: 3 })");
    expect(page).toContain("placeholder={t('hint')}");

    // layout: provider swapped, validation gone, lang from the route param
    // (static/SSG, not request-scoped getLocale), routing.locales inlined so
    // the deleted routing file is not imported
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('<GTProvider>');
    expect(layout).toContain('lang={locale}');
    expect(layout).not.toContain('getLocale()');
    expect(layout).not.toContain('NextIntlClientProvider');
    expect(layout).toMatch(/\[\s*['"]en['"],\s*['"]es['"]\s*\]\.map/);
    expect(layout).not.toContain('@/i18n/routing');

    // static rendering preserved: getLocale/getRegion resolvers emitted next
    // to loadDictionary so gt-next reads the locale from next/root-params
    // ([locale] is the root layout here, no separate root layout above it)
    expect(read(cwd, 'src/getLocale.ts')).toContain(
      "import { locale } from 'next/root-params'"
    );
    expect(read(cwd, 'src/getRegion.ts')).toContain(
      'export default async function getRegion()'
    );
    expect(read(cwd, 'gt-migrate-report.md')).toContain(
      'Static rendering preserved'
    );

    // navigation rewritten
    const navigation = read(cwd, 'src/i18n/navigation.ts');
    expect(navigation).toMatch(/gt-next\/link/);

    // configs
    expect(read(cwd, 'next.config.ts')).toContain('withGTConfig');
    expect(read(cwd, 'middleware.ts')).toContain('createNextMiddleware');
    const gtConfig = JSON.parse(read(cwd, 'gt.config.json'));
    expect(gtConfig.locales).toEqual(['en', 'es']);
    expect(read(cwd, 'src/loadDictionary.ts')).toContain(
      '../messages/${locale}.json'
    );

    // teardown: fully migrated -> next-intl gone, i18n config files deleted
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/routing.ts'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(false);

    // translations preserved untouched
    expect(read(cwd, 'messages/es.json')).toContain('Bienvenido a demo');

    // gt-next gets installed (the rewritten files import it)
    expect(vi.mocked(installPackage)).toHaveBeenCalledWith(
      'gt-next',
      expect.anything(),
      false,
      cwd
    );

    // report exists and mentions next steps
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('# gt migrate report');
    expect(report).toContain('npx gt generate');
    // install succeeded, so no manual install step
    expect(report).not.toContain('Install gt-next');
  });

  it('retains a routing file reachable only through a retained request file', async () => {
    // boot.ts (a plain app file, no next-intl API) imports request.ts, so
    // request.ts is retained; request.ts imports './routing', so routing.ts
    // must be retained too, since deleting it would leave the surviving
    // request.ts with a dangling ./routing import that breaks the next build.
    const cwd = makeApp({
      'src/app/boot.ts': [
        "import request from '@/i18n/request';",
        'export const boot = request;',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // request.ts survives because boot.ts still imports it
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(true);
    // routing.ts ALSO survives (its only importer is the retained request.ts)
    expect(fs.existsSync(path.join(cwd, 'src/i18n/routing.ts'))).toBe(true);
    // both retained files still import next-intl, so the dependency stays
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    // the report names both retained files
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('src/i18n/request.ts');
    expect(report).toContain('src/i18n/routing.ts');
  });

  it('reports a manual install step when installing gt-next fails', async () => {
    const cwd = makeApp();
    vi.mocked(installPackage).mockRejectedValueOnce(new Error('offline'));
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // migration still completes; the report carries the install step
    expect(read(cwd, 'gt-migrate-report.md')).toContain('Install gt-next');
  });

  it('keeps next-intl infra when a file must be skipped', async () => {
    const cwd = makeApp({
      'src/components/Price.tsx': [
        "import { useFormatter } from 'next-intl';",
        'export function Price({ value }: { value: number }) {',
        '  const format = useFormatter();',
        '  return <span>{format.number(value)}</span>;',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // skipped file untouched
    expect(read(cwd, 'src/components/Price.tsx')).toContain('useFormatter');
    // provider retained nested inside GTProvider, on the resolved locale
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('GTProvider');
    expect(layout).toContain('NextIntlClientProvider');
    // fed the static route-param locale (SSG-safe), not a request-scoped
    // getLocale(); partial mode keeps the hasLocale guard, which both validates
    // and narrows `locale` to the augmented union the provider prop expects
    expect(layout).toMatch(/<NextIntlClientProvider[^>]*locale=\{locale\}/);
    expect(layout).not.toContain('getLocale()');
    expect(layout).toContain('hasLocale(routing.locales, locale)');
    // the next-intl plugin stays composed so the request config resolves
    const nextConfig = read(cwd, 'next.config.ts');
    expect(nextConfig).toContain('createNextIntlPlugin');
    expect(nextConfig).toContain('withGTConfig');
    // dep + config files retained
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(true);
    // request config fallback rewired to the resolved gt-next locale, so
    // skipped files render the page locale instead of the default one
    const request = read(cwd, 'src/i18n/request.ts');
    expect(request).toContain('_gtRequestLocale.then');
    expect(request).toMatch(
      /import \{ getLocale \} from ["']gt-next\/server["']/
    );
    // report lists the skip
    expect(read(cwd, 'gt-migrate-report.md')).toContain('Price.tsx');
  });

  it('keeps the root provider when a later layout is the only skip', async () => {
    // The only skip in the whole app is a nested layout that globs AFTER the
    // root layout. Single-pass sequential processing converts the root layout
    // (skip set still empty, provider dropped) before the nested layout's
    // skip lands, leaving the skipped subtree with no NextIntlClientProvider;
    // the fixed-point classification pass must retain it.
    const cwd = makeApp({
      'src/app/[locale]/shop/layout.tsx': [
        "'use client';",
        "import { useFormatter } from 'next-intl';",
        'export default function ShopLayout({',
        '  children,',
        '}: {',
        '  children: React.ReactNode;',
        '}) {',
        '  const format = useFormatter();',
        '  return <section title={format.number(1)}>{children}</section>;',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // skipped nested layout untouched
    expect(read(cwd, 'src/app/[locale]/shop/layout.tsx')).toContain(
      'useFormatter'
    );
    // root layout keeps the provider (nested inside GTProvider, explicit
    // locale) so the skipped subtree still has a next-intl context
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('GTProvider');
    expect(layout).toMatch(/<NextIntlClientProvider[^>]*locale=\{locale\}/);
    // partial migration: dep and request config survive
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(true);
    // report lists the layout skip
    expect(read(cwd, 'gt-migrate-report.md')).toContain('shop/layout.tsx');
  });

  it('dry run writes nothing', async () => {
    const cwd = makeApp();
    const before = read(cwd, 'src/app/[locale]/page.tsx');
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: true,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    expect(read(cwd, 'src/app/[locale]/page.tsx')).toBe(before);
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'gt-migrate-report.md'))).toBe(false);
  });

  it('skips t.rich files instead of discarding translations', async () => {
    const cwd = makeApp({
      'src/components/Terms.tsx': [
        "import { useTranslations } from 'next-intl';",
        'export function Terms() {',
        "  const t = useTranslations('Home');",
        "  return <p>{t.rich('terms', { b: (chunks) => <b>{chunks}</b> })}</p>;",
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // file untouched, teardown blocked, reason says to convert by hand
    expect(read(cwd, 'src/components/Terms.tsx')).toContain('t.rich');
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(read(cwd, 'gt-migrate-report.md')).toContain('convert it manually');
  });

  it('converts a root-level i18n/ directory and still tears down safely', async () => {
    const cwd = makeApp();
    // Move the i18n config dir out of src/ — the shape from the field report
    // that the old defaults never scanned.
    fs.mkdirSync(path.join(cwd, 'i18n'));
    for (const file of ['routing.ts', 'request.ts', 'navigation.ts']) {
      fs.renameSync(
        path.join(cwd, 'src/i18n', file),
        path.join(cwd, 'i18n', file)
      );
    }
    fs.rmdirSync(path.join(cwd, 'src/i18n'));
    fs.writeFileSync(
      path.join(cwd, 'middleware.ts'),
      read(cwd, 'middleware.ts').replace('./src/i18n/routing', './i18n/routing')
    );
    fs.writeFileSync(
      path.join(cwd, 'i18n/request.ts'),
      read(cwd, 'i18n/request.ts').replace('../../messages', '../messages')
    );
    fs.writeFileSync(
      path.join(cwd, 'src/app/[locale]/layout.tsx'),
      read(cwd, 'src/app/[locale]/layout.tsx').replace(
        "'@/i18n/routing'",
        "'../../../i18n/routing'"
      )
    );

    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // navigation was converted, not left importing a deleted routing file
    expect(read(cwd, 'i18n/navigation.ts')).toMatch(/gt-next\/link/);
    expect(read(cwd, 'i18n/navigation.ts')).not.toMatch(/from ['"]next-intl/);
    expect(read(cwd, 'i18n/navigation.ts')).not.toMatch(/['"].*\/routing['"]/);
    // full teardown completed
    expect(fs.existsSync(path.join(cwd, 'i18n/routing.ts'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'i18n/request.ts'))).toBe(false);
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
  });

  it('blocks teardown when --src leaves next-intl usage out of scope', async () => {
    const cwd = makeApp();
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
        src: ['src/app/**/*.{js,jsx,ts,tsx}'],
      },
      'next-intl',
      cwd
    );
    // src/i18n/navigation.ts is outside the scope and still uses next-intl
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(true);
    expect(read(cwd, 'gt-migrate-report.md')).toContain('not scanned');
  });

  it('retains a separate provider file (with its messages wiring) in partial mode', async () => {
    // A skipped file forces partial mode; the standalone provider file must
    // keep its NextIntlClientProvider so the skipped file still has a next-intl
    // context. Regression: it used to run with retainNextIntlProvider=false and
    // get rewritten to a bare <GTProvider>, deleting the only provider anywhere.
    const cwd = makeApp({
      ...SEPARATE_PROVIDER_FILES,
      'src/components/Price.tsx': [
        "import { useFormatter } from 'next-intl';",
        'export function Price({ value }: { value: number }) {',
        '  const format = useFormatter();',
        '  return <span>{format.number(value)}</span>;',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // provider file untouched swap: NextIntlClientProvider kept, still fed by
    // useMessages(), still importing from next-intl (no bare GTProvider swap)
    const providers = read(cwd, 'src/components/Providers.tsx');
    expect(providers).toContain('NextIntlClientProvider');
    expect(providers).toContain('messages={messages}');
    expect(providers).toContain('useMessages');
    expect(providers).toMatch(/from ['"]next-intl['"]/);
    expect(providers).not.toContain('GTProvider');

    // the skipped file is left alone
    expect(read(cwd, 'src/components/Price.tsx')).toContain('useFormatter');

    // the layout provides GTProvider around the retained provider chain
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('GTProvider');
    expect(layout).toContain('<Providers>');

    // next-intl stays installed for the retained provider + skipped file
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
  });

  it('fully swaps a separate provider file when nothing is skipped', async () => {
    // No skips anywhere -> full mode: the standalone provider file is swapped
    // to <GTProvider> and its next-intl wiring removed, exactly as a single
    // pass did before deferral.
    const cwd = makeApp({ ...SEPARATE_PROVIDER_FILES });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    const providers = read(cwd, 'src/components/Providers.tsx');
    expect(providers).toContain('GTProvider');
    expect(providers).toMatch(/from ['"]gt-next['"]/);
    expect(providers).not.toContain('NextIntlClientProvider');
    expect(providers).not.toContain('useMessages');
    expect(providers).not.toMatch(/from ['"]next-intl/);

    // full teardown: next-intl removed since every file converted
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
  });

  it('treats a JSX-less layout.ts as a layout and degrades gracefully', async () => {
    // A pure-TS layout.ts (no JSX). It must go through the layout pass (which
    // agrees with emitGtFiles that layout.ts is a layout), so its locale guard
    // is handled instead of tripping the generic pass into a hasLocale skip —
    // and the layout pass must never emit JSX into a .ts file.
    const cwd = makeApp({
      'src/app/[locale]/layout.ts': [
        "import { hasLocale } from 'next-intl';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { notFound } from 'next/navigation';",
        "import { routing } from '@/i18n/routing';",
        'export default function LocaleLayout({',
        '  children,',
        '  params,',
        '}: {',
        '  children: React.ReactNode;',
        '  params: { locale: string };',
        '}) {',
        '  if (!hasLocale(routing.locales, params.locale)) {',
        '    notFound();',
        '  }',
        '  setRequestLocale(params.locale);',
        '  return children;',
        '}',
      ].join('\n'),
    });
    // Replace the default .tsx layout so layout.ts is the [locale] layout.
    fs.rmSync(path.join(cwd, 'src/app/[locale]/layout.tsx'));

    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    const layout = read(cwd, 'src/app/[locale]/layout.ts');
    // handled as a layout in full mode: guard + setRequestLocale removed, its
    // next-intl imports gone (not skipped for an unsupported hasLocale)
    expect(layout).not.toContain('hasLocale');
    expect(layout).not.toContain('setRequestLocale');
    expect(layout).not.toMatch(/from ['"]next-intl/);
    expect(layout).toContain('return children');
    // no JSX ever emitted into a .ts file, no crash
    expect(layout).not.toContain('<');
    expect(layout).not.toContain('GTProvider');

    // it was transformed, not skipped -> full teardown proceeds
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    expect(read(cwd, 'gt-migrate-report.md')).not.toMatch(
      /layout\.ts.*skipped|skipped.*layout\.ts/
    );
  });

  it('converts a file whose only createNavigation is in a comment', async () => {
    // The driver picks the navigation transform by a string match. A false
    // match (comment, unrelated helper) must fall through to the generic
    // source pass instead of leaving real next-intl usage untouched and
    // unskipped beneath a full teardown.
    const cwd = makeApp({
      'src/components/NavNote.tsx': [
        '// revisit createNavigation once these routes localize',
        "import { useTranslations } from 'next-intl';",
        'export function NavNote() {',
        "  const t = useTranslations('Home');",
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    const navNote = read(cwd, 'src/components/NavNote.tsx');
    expect(navNote).toMatch(/from ["']gt-next["']/);
    expect(navNote).not.toMatch(/from ['"]next-intl['"]/);
    // nothing was silently bypassed, so the full teardown is legitimate
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
  });

  it('skips an unrecognized createNavigation shape and holds back teardown', async () => {
    // `const navigation = createNavigation(routing)` is not the supported
    // destructured wrapper. It must register as a skip (holding next-intl in
    // package.json), never as an untouched non-skip beneath a full teardown.
    const cwd = makeApp({
      'src/i18n/navigation.ts': [
        "import { createNavigation } from 'next-intl/navigation';",
        "import { routing } from './routing';",
        'const navigation = createNavigation(routing);',
        'export default navigation;',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // file untouched, dependency retained, skip surfaced in the report
    expect(read(cwd, 'src/i18n/navigation.ts')).toContain(
      'const navigation = createNavigation(routing);'
    );
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(read(cwd, 'gt-migrate-report.md')).toContain('navigation.ts');
  });

  it('keeps next-intl in package.json when a retained routing file still imports it', async () => {
    // A locale switcher imports the routing file for its locale list but uses
    // no next-intl API, so it is never a skip. The routing file must be kept
    // (something imports it) AND next-intl must stay in package.json, or the
    // retained file's next-intl/routing import breaks the build.
    const cwd = makeApp({
      'src/components/LocaleSwitcher.tsx': [
        "import { routing } from '@/i18n/routing';",
        'export function LocaleSwitcher() {',
        '  return (',
        '    <ul>',
        '      {routing.locales.map((locale) => (',
        '        <li key={locale}>{locale}</li>',
        '      ))}',
        '    </ul>',
        '  );',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // routing file kept for its importer
    expect(fs.existsSync(path.join(cwd, 'src/i18n/routing.ts'))).toBe(true);
    // and the dependency it imports survives with it
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(read(cwd, 'gt-migrate-report.md')).toContain('routing');
  });

  it('keeps a routing file alive for a bare side-effect import', async () => {
    // `import './i18n/routing';` has no `from` and no paren, but deleting its
    // target still breaks the build. The importer detection must count it.
    const cwd = makeApp({
      'src/register.ts': [
        "import './i18n/routing';",
        'export const registered = true;',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    expect(fs.existsSync(path.join(cwd, 'src/i18n/routing.ts'))).toBe(true);
    // the retained routing file imports next-intl/routing, so the dependency
    // survives with it
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
  });

  it('honors --config for the gt.config.json read and write', async () => {
    const cwd = makeApp();
    fs.mkdirSync(path.join(cwd, 'config'));
    fs.writeFileSync(
      path.join(cwd, 'config/gt.config.json'),
      JSON.stringify({ projectId: 'prj_demo' }, null, 2)
    );
    await handleMigrateCommand(
      {
        config: 'config/gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // merged in place at the flag's path, existing keys preserved
    const gtConfig = JSON.parse(read(cwd, 'config/gt.config.json'));
    expect(gtConfig.projectId).toBe('prj_demo');
    expect(gtConfig.locales).toEqual(['en', 'es']);
    // no second, shadowing config at the root
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
  });
});
