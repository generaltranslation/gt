import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMigrateCommand } from '../../cli/commands/migrate.js';
import { logger } from '../../console/logger.js';
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

// A project with exactly the files given (no next-intl scaffold), for the
// --from validation and nothing-to-migrate backstop cases.
function makeBareProject(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-bare-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

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
        inline: false,
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

  it('reports a manual install step when installing gt-next fails', async () => {
    const cwd = makeApp();
    vi.mocked(installPackage).mockRejectedValueOnce(new Error('offline'));
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        inline: false,
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
        inline: false,
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

  it('dry run writes nothing', async () => {
    const cwd = makeApp();
    const before = read(cwd, 'src/app/[locale]/page.tsx');
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        inline: false,
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

  it('--inline converts the pure-text title and simple t.rich', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': [
        "import { useTranslations } from 'next-intl';",
        'export default function Home() {',
        "  const t = useTranslations('Home');",
        '  return (',
        '    <main>',
        "      <h1>{t('title')}</h1>",
        "      <p>{t('greeting', { name: 'Ada' })}</p>",
        "      <p>{t.rich('terms', { b: (chunks) => <b>{chunks}</b> })}</p>",
        "      <input placeholder={t('hint')} />",
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        inline: true,
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    const page = read(cwd, 'src/app/[locale]/page.tsx');
    expect(page).toContain('Welcome to demo');
    expect(page).not.toContain("t('title')");
    expect(page).toContain('<b>terms</b>');
    expect(page).not.toContain('t.rich');
    // args/attribute stay on dictionary path
    expect(page).toContain("t('greeting', { name: 'Ada' })");
    expect(page).toContain("placeholder={t('hint')}");
    // report warns that inlined content needs regeneration
    expect(read(cwd, 'gt-migrate-report.md')).toContain('regenerate');
  });

  it('skips t.rich files in default mode instead of discarding translations', async () => {
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
        inline: false,
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    // file untouched, teardown blocked, reason points at --inline
    expect(read(cwd, 'src/components/Terms.tsx')).toContain('t.rich');
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(read(cwd, 'gt-migrate-report.md')).toContain('--inline');
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
        inline: false,
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
        inline: false,
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
        inline: false,
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
        inline: false,
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

  it('errors when --from names a library absent from package.json', async () => {
    // The reviewer's t3-i18next shape: react-i18next/i18next, no next-intl, a
    // messages catalog, and a page on react-i18next. --from next-intl must not
    // silently "succeed" writing scaffolding while leaving every file untouched.
    const cwd = makeBareProject({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          'react-i18next': '^14.0.0',
          i18next: '^23.0.0',
          react: '19.0.0',
        },
      }),
      'messages/en.json': JSON.stringify({ Home: { title: 'Hi' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Hola' } }),
      'src/app/page.tsx': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export default function Page() {',
        '  const { t } = useTranslation();',
        "  return <h1>{t('Home.title')}</h1>;",
        '}',
      ].join('\n'),
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    try {
      await expect(
        handleMigrateCommand(
          {
            config: 'gt.config.json',
            inline: false,
            dryRun: false,
            yes: true,
            allowDirty: true,
            from: 'next-intl',
          },
          'i18next',
          cwd
        )
      ).rejects.toThrow('process.exit:1');
    } finally {
      exitSpy.mockRestore();
    }
    // errored before writing anything, and the source file is untouched
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
    expect(read(cwd, 'src/app/page.tsx')).toContain('react-i18next');
  });

  it('warns instead of exiting 0 when a run matches nothing', async () => {
    // next-intl IS a dependency (so the presence check passes and no --from is
    // needed), a catalog is discoverable, but no source file imports next-intl.
    // The run migrates nothing; it must say so rather than reporting success.
    const cwd = makeBareProject({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          'next-intl': '^4.1.0',
          react: '19.0.0',
        },
      }),
      'messages/en.json': JSON.stringify({ Home: { title: 'Hi' } }),
      'messages/es.json': JSON.stringify({ Home: { title: 'Hola' } }),
      'src/app/page.tsx': [
        'export default function Page() {',
        '  return <h1>Static heading</h1>;',
        '}',
      ].join('\n'),
    });
    const warnSpy = vi.spyOn(logger, 'warn');
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        inline: false,
        dryRun: true,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );
    const warnings = warnSpy.mock.calls.map((call) => String(call[0]));
    warnSpy.mockRestore();
    expect(warnings.some((line) => /Nothing to migrate/.test(line))).toBe(true);
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
        inline: false,
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
});
