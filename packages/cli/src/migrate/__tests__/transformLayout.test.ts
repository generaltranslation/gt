import { describe, expect, it } from 'vitest';
import { transformLayoutFile } from '../transformLayout.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(skipped: string[] = []): MigrationContext {
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

const localeLayout = [
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

describe('transformLayoutFile', () => {
  it('migrates a canonical [locale] layout', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      localeLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('<GTProvider>');
    expect(result.code).toContain('lang={await getLocale()}');
    expect(result.code).not.toContain('NextIntlClientProvider');
    expect(result.code).not.toContain('setRequestLocale');
    expect(result.code).not.toContain('hasLocale');
    expect(result.code).not.toContain('notFound()');
    expect(result.code).toMatch(
      /import \{.*getLocale.*\} from ["']gt-next\/server["']/
    );
    expect(
      result.todos.some((todo) => todo.reason.includes('locale validation'))
    ).toBe(true);
    // guard removal left the params destructure unused — it must go too
    expect(result.code).not.toContain('const { locale }');
  });

  it('keeps the params destructure while locale is still referenced', () => {
    const withExtraUse = localeLayout.replace(
      '<html lang={locale}>',
      '<html lang={locale} data-locale={locale}>'
    );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withExtraUse,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('const { locale } = await params');
    expect(result.code).toContain('data-locale={locale}');
    expect(result.code).toContain('lang={await getLocale()}');
  });

  it('inserts GTProvider when no provider exists', () => {
    const plain = [
      'export default function RootLayout({ children }: { children: React.ReactNode }) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/layout.tsx',
      plain,
      makeContext()
    );
    expect(result.code).toContain('<GTProvider>');
    expect(result.code).toContain('</GTProvider>');
    expect(result.code).toMatch(/import \{ GTProvider \} from ["']gt-next["']/);
    // static lang attribute on a non-[locale] layout is left alone
    expect(result.code).toContain('lang="en"');
  });

  it('inlines routing.locales on a full migration (routing file gets deleted)', () => {
    const withStaticParams = localeLayout.replace(
      'export default async function LocaleLayout({',
      [
        'export function generateStaticParams() {',
        '  return routing.locales.map((locale) => ({ locale }));',
        '}',
        'export default async function LocaleLayout({',
      ].join('\n')
    );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withStaticParams,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/\[\s*['"]en['"],\s*['"]es['"]\s*\]\.map/);
    expect(result.code).not.toContain('routing.locales');
    expect(result.code).not.toContain('@/i18n/routing');
  });

  it('leaves routing references alone while skips retain the routing file', () => {
    const withStaticParams = localeLayout.replace(
      'export default async function LocaleLayout({',
      [
        'export function generateStaticParams() {',
        '  return routing.locales.map((locale) => ({ locale }));',
        '}',
        'export default async function LocaleLayout({',
      ].join('\n')
    );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withStaticParams,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('routing.locales');
  });

  it('keeps NextIntlClientProvider nested inside GTProvider when skips exist', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      localeLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('NextIntlClientProvider');
    expect(result.code).toContain('<GTProvider>');
    const gtIndex = result.code!.indexOf('<GTProvider>');
    const nextIntlIndex = result.code!.indexOf('<NextIntlClientProvider');
    expect(gtIndex).toBeGreaterThan(-1);
    expect(nextIntlIndex).toBeGreaterThan(gtIndex);
    // messages loading must survive for the retained provider
    expect(result.code).toContain('getMessages');
    // gt-next middleware no longer feeds next-intl's request config, so the
    // retained provider gets the resolved locale explicitly
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{await getLocale\(\)\}/
    );
  });
});
