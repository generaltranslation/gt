import { describe, expect, it } from 'vitest';
import { transformLayoutFile } from '../transformLayout.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

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
    adapter: nextIntlAdapter,
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
    // lang resolves from the route param (static/SSG), not request-scoped
    // getLocale() which would force dynamic rendering
    expect(result.code).toContain('lang={locale}');
    expect(result.code).not.toContain('NextIntlClientProvider');
    expect(result.code).not.toContain('setRequestLocale');
    expect(result.code).not.toContain('hasLocale');
    expect(result.code).not.toContain('notFound()');
    // full migration: nothing request-scoped remains, so getLocale is not
    // imported and no getLocale() call is introduced
    expect(result.code).not.toMatch(
      /import \{.*getLocale.*\} from ["']gt-next\/server["']/
    );
    expect(result.code).not.toContain('getLocale()');
    expect(
      result.todos.some((todo) => todo.reason.includes('locale validation'))
    ).toBe(true);
    // lang still references the param, so the params destructure is retained
    expect(result.code).toContain('const { locale }');
  });

  it('keeps non-locale notFound() guards intact', () => {
    const withSlugGuard = localeLayout.replace(
      '  setRequestLocale(locale);',
      [
        "  const validSlugs = ['a', 'b'];",
        "  const slug = 'a';",
        '  if (!validSlugs.includes(slug)) {',
        '    notFound();',
        '  }',
        '  setRequestLocale(locale);',
      ].join('\n')
    );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withSlugGuard,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // locale guard removed, slug guard untouched
    expect(result.code).not.toContain('hasLocale');
    expect(result.code).toContain('validSlugs.includes(slug)');
    expect(result.code).toContain('notFound()');
  });

  it('removes guards on locale-named constants too', () => {
    const withConstGuard = localeLayout
      .replace(
        'if (!hasLocale(routing.locales, locale)) {',
        'if (!SUPPORTED_LOCALES.includes(locale)) {'
      )
      .replace(
        "import { hasLocale } from 'next-intl';",
        "const SUPPORTED_LOCALES = ['en', 'es'];"
      );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withConstGuard,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('SUPPORTED_LOCALES.includes');
    expect(result.code).not.toContain('notFound()');
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
    // lang stays on the param (static), not a request-scoped getLocale()
    expect(result.code).toContain('lang={locale}');
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
    // retained provider gets the resolved locale explicitly — via the static
    // route-param binding (SSG-safe), never a request-scoped getLocale()
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{locale\}/
    );
    expect(result.code).not.toContain('getLocale()');
    expect(result.code).not.toMatch(
      /import \{.*getLocale.*\} from ["']gt-next\/server["']/
    );
    // partial mode retains next-intl, so the locale-validation guard stays put:
    // it keeps runtime validation and narrows `locale` for the retained provider
    expect(result.code).toContain('hasLocale(routing.locales, locale)');
  });

  it('passes the param locale (not getLocale) to a retained provider annotated with next-intl Locale', () => {
    const localeTypedLayout = [
      "import { Locale, hasLocale, NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      "import { notFound } from 'next/navigation';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: Locale }>;',
      '}) {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
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
      localeTypedLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // partial mode: next-intl is retained, so the augmented `Locale` type stays
    // imported and the params annotation is NOT rewritten to string
    expect(result.code).toMatch(
      /import \{[^}]*\bLocale\b[^}]*\} from ["']next-intl["']/
    );
    expect(result.code).toMatch(/Promise<\{\s*locale:\s*Locale;?\s*\}>/);
    expect(result.code).not.toMatch(/locale:\s*string/);
    // the retained provider gets the param binding, typed to that `Locale` union
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{locale\}/
    );
    expect(result.code).not.toContain('getLocale()');
  });

  it('falls back to getLocale() for a retained provider without a params destructure', () => {
    const rootLayout = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export default async function RootLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  const messages = await getMessages();',
      '  return (',
      '    <html lang="en">',
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
      'src/app/layout.tsx',
      rootLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // no route-param locale in scope, so the request-scoped resolver is used
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{await getLocale\(\)\}/
    );
    expect(result.code).toMatch(
      /import \{[^}]*getLocale[^}]*\} from ["']gt-next\/server["']/
    );
  });

  it('marks a non-async component function async for the getLocale() fallback', () => {
    const syncRootLayout = [
      "import { NextIntlClientProvider } from 'next-intl';",
      'export default function RootLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return (',
      '    <html lang="en">',
      '      <body>',
      '        <NextIntlClientProvider>',
      '          {children}',
      '        </NextIntlClientProvider>',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/layout.tsx',
      syncRootLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // provider lives directly in the component Next.js awaits, so making it
    // async is safe: the fallback is applied and the component becomes async
    expect(result.code).toMatch(/export default async function RootLayout/);
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{await getLocale\(\)\}/
    );
    expect(result.code).toMatch(
      /import \{[^}]*getLocale[^}]*\} from ["']gt-next\/server["']/
    );
    expect(result.code).toContain('<GTProvider>');
  });

  it('skips (never emits an async helper) when the retained provider fallback sits in a nested sync helper', () => {
    const nestedHelperLayout = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export default async function RootLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  const messages = await getMessages();',
      '  const render = () => (',
      '    <NextIntlClientProvider messages={messages}>',
      '      {children}',
      '    </NextIntlClientProvider>',
      '  );',
      '  return (',
      '    <html lang="en">',
      '      <body>{render()}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/layout.tsx',
      nestedHelperLayout,
      makeContext(['src/components/Price.tsx'])
    );
    // degrade: the whole layout is skipped (code === null leaves the original
    // untouched) and surfaces in the report, rather than silently emitting
    // `const render = async () => ...` with an unchanged `{render()}` call site
    // that would render a pending Promise
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([
      'retained NextIntlClientProvider has no route `locale` param in scope and sits inside a synchronous helper that cannot be made async safely; pass its `locale` prop manually (the layout keeps working on next-intl until then)',
    ]);
  });
});
