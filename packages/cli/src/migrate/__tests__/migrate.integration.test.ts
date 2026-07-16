import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMigrateCommand } from '../../cli/commands/migrate.js';

vi.mock('../../hooks/postProcess.js', () => ({
  formatFiles: vi.fn(async () => {}),
  detectFormatter: vi.fn(async () => null),
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
      "      <p>{t.rich('terms', { b: (chunks) => <b>{chunks}</b> })}</p>",
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

    // page: hooks swapped, dictionary calls intact, t.rich inlined
    const page = read(cwd, 'src/app/[locale]/page.tsx');
    expect(page).toMatch(/import \{.*useTranslations.*\} from ["']gt-next["']/);
    expect(page).toContain("t('greeting', { name: 'Ada' })");
    expect(page).toContain("t('items', { count: 3 })");
    expect(page).toContain('<b>terms</b>');
    expect(page).not.toContain('t.rich');
    expect(page).toContain("placeholder={t('hint')}");

    // layout: provider swapped, validation gone, lang via getLocale
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('<GTProvider>');
    expect(layout).toContain('lang={await getLocale()}');
    expect(layout).not.toContain('NextIntlClientProvider');

    // navigation rewritten
    const navigation = read(cwd, 'src/i18n/navigation.ts');
    expect(navigation).toMatch(/gt-next\/link/);

    // configs
    expect(read(cwd, 'next.config.ts')).toContain('withGTConfig');
    expect(read(cwd, 'middleware.ts')).toContain('createNextMiddleware');
    const gtConfig = JSON.parse(read(cwd, 'gt.config.json'));
    expect(gtConfig.locales).toEqual(['en', 'es']);
    expect(read(cwd, 'loadDictionary.ts')).toContain('/messages/${locale}.json');

    // teardown: fully migrated -> next-intl gone, i18n config files deleted
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/routing.ts'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(false);

    // translations preserved untouched
    expect(read(cwd, 'messages/es.json')).toContain('Bienvenido a demo');

    // report exists and mentions next steps
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('# gt migrate report');
    expect(report).toContain('npx gt generate');
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
    // provider retained nested inside GTProvider
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('GTProvider');
    expect(layout).toContain('NextIntlClientProvider');
    // dep + config files retained
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
    expect(fs.existsSync(path.join(cwd, 'src/i18n/request.ts'))).toBe(true);
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

  it('--inline converts the pure-text title', async () => {
    const cwd = makeApp();
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
    // args/plural/attribute stay on dictionary path
    expect(page).toContain("t('greeting', { name: 'Ada' })");
    expect(page).toContain("placeholder={t('hint')}");
  });
});
