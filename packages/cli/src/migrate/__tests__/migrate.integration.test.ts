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
          next: '15.3.0',
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

    // layout: provider swapped, validation gone, lang via getLocale,
    // routing.locales inlined so the deleted routing file is not imported
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('<GTProvider>');
    expect(layout).toContain('lang={await getLocale()}');
    expect(layout).not.toContain('NextIntlClientProvider');
    expect(layout).toMatch(/\[\s*['"]en['"],\s*['"]es['"]\s*\]\.map/);
    expect(layout).not.toContain('@/i18n/routing');

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
    expect(layout).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{await getLocale\(\)\}/
    );
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
});
