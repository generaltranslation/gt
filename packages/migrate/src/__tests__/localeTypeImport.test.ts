import { describe, expect, it } from 'vitest';
import { transformSourceFile } from '../transforms/transformSource.js';
import { transformLayoutFile } from '../transforms/transformLayout.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(): MigrationContext {
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
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

function transform(
  code: string,
  options: Parameters<typeof transformSourceFile>[3] = {}
) {
  return transformSourceFile('src/app/page.tsx', code, makeContext(), options);
}

describe('transformSourceFile: next-intl Locale type', () => {
  it('converts a mixed import with Locale alongside a supported API', () => {
    const result = transform(
      [
        "import { Locale, useTranslations } from 'next-intl';",
        'export function Page({ locale }: { locale: Locale }) {',
        "  const t = useTranslations('Home');",
        "  return <p>{t('title')}{locale}</p>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    // supported API still swapped
    expect(result.code).toMatch(
      /import \{ useTranslations \} from ["']gt-next["']/
    );
    // Locale specifier dropped, no residual next-intl import
    expect(result.code).not.toContain('next-intl');
    // annotation rewritten to string
    expect(result.code).toMatch(/locale:\s*string/);
    expect(result.code).not.toMatch(/locale:\s*Locale/);
  });

  it('does not add a skip reason for Locale', () => {
    const result = transform(
      [
        "import { Locale, useTranslations } from 'next-intl';",
        'export function Page({ locale }: { locale: Locale }) {',
        "  const t = useTranslations('Home');",
        '  return <p>{locale}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons.join(' ')).not.toContain('Locale');
  });

  it('handles a type-only import of Locale as the sole next-intl usage', () => {
    const result = transform(
      [
        "import type { Locale } from 'next-intl';",
        'export function tag(locale: Locale): string {',
        '  return locale;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    expect(result.code).not.toContain('next-intl');
    expect(result.code).toMatch(/locale:\s*string/);
  });

  it('handles an inline type specifier alongside a supported API', () => {
    const result = transform(
      [
        "import { type Locale, useTranslations } from 'next-intl';",
        'export function Page({ locale }: { locale: Locale }) {',
        "  const t = useTranslations('Home');",
        '  return <p>{locale}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /import \{ useTranslations \} from ["']gt-next["']/
    );
    expect(result.code).not.toContain('next-intl');
    expect(result.code).toMatch(/locale:\s*string/);
  });

  it('rewrites an aliased Locale import and its references', () => {
    const result = transform(
      [
        "import { Locale as AppLocale, useLocale } from 'next-intl';",
        'export function Page() {',
        '  const locale: AppLocale = useLocale();',
        '  return <p>{locale}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('next-intl');
    expect(result.code).not.toContain('AppLocale');
    expect(result.code).toMatch(/locale:\s*string/);
  });

  it('rewrites a Locale inside a generic', () => {
    const result = transform(
      [
        "import { Locale, getLocale } from 'next-intl/server';",
        'async function read(): Promise<{ locale: Locale }> {',
        '  return { locale: await getLocale() };',
        '}',
        'export default read;',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/Promise<\{\s*locale:\s*string;?\s*\}>/);
    expect(result.code).not.toMatch(/locale:\s*Locale/);
  });

  it('drops an `as Locale` cast entirely', () => {
    const result = transform(
      [
        "import { Locale, useLocale } from 'next-intl';",
        'export function Page() {',
        '  const locale = useLocale() as Locale;',
        '  return <p>{locale}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('as Locale');
    expect(result.code).toMatch(/const locale = useLocale\(\)/);
  });

  it('leaves a user-defined local Locale type untouched', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        "type Locale = 'en' | 'es';",
        'export function Page({ locale }: { locale: Locale }) {',
        "  const t = useTranslations('Home');",
        '  return <p>{locale}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain("type Locale = 'en' | 'es'");
    expect(result.code).toMatch(/locale:\s*Locale/);
    expect(result.code).not.toMatch(/locale:\s*string/);
  });

  it('distinguishes an aliased next-intl Locale from a local Locale type', () => {
    const result = transform(
      [
        "import { Locale as AppLocale, useTranslations } from 'next-intl';",
        "type Locale = 'en' | 'es';",
        'export function Page({ a, b }: { a: AppLocale; b: Locale }) {',
        "  const t = useTranslations('Home');",
        '  return <p>{a}{b}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // the next-intl-bound alias becomes string
    expect(result.code).toMatch(/a:\s*string/);
    // the local type is preserved
    expect(result.code).toContain("type Locale = 'en' | 'es'");
    expect(result.code).toMatch(/b:\s*Locale/);
    expect(result.code).not.toContain('AppLocale');
  });

  it('still skips genuinely unsupported APIs even when Locale is present', () => {
    const result = transform(
      [
        "import { useFormatter, Locale } from 'next-intl';",
        'export function Price({ locale }: { locale: Locale }) {',
        '  const format = useFormatter();',
        '  return <span>{locale}{format.number(1)}</span>;',
        '}',
      ].join('\n')
    );
    // whole file skipped -> untouched
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('useFormatter');
    // the skip is about the real unsupported API, not Locale
    expect(result.skipReasons.join(' ')).not.toContain('Locale');
  });

  it('keeps the Locale import and its references when next-intl is retained', () => {
    // Partial migration: retainProvider mirrors how transformLayoutFile
    // invokes the source pass once other files are skipped. next-intl stays
    // installed, so the augmented `Locale` type must be preserved (not string).
    const result = transform(
      [
        "import { Locale, NextIntlClientProvider } from 'next-intl';",
        'export default function Layout({',
        '  children,',
        '  params,',
        '}: {',
        '  children: React.ReactNode;',
        '  params: Promise<{ locale: Locale }>;',
        '}) {',
        '  return (',
        '    <NextIntlClientProvider>{children}</NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n'),
      { retainProvider: true, dropLocaleValidation: true }
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    // provider left untouched for later nesting under GTProvider
    expect(result.code).toContain('NextIntlClientProvider');
    expect(result.code).not.toContain('GTProvider');
    // Locale specifier kept on the retained next-intl import
    expect(result.code).toMatch(
      /import \{[^}]*\bLocale\b[^}]*\} from ["']next-intl["']/
    );
    // references NOT rewritten to string
    expect(result.code).toMatch(/Promise<\{\s*locale:\s*Locale;?\s*\}>/);
    expect(result.code).not.toMatch(/locale:\s*string/);
  });

  it('drops a retained Locale import when no reference survives', () => {
    // The only Locale reference is an `as Locale` cast inside a getTranslations
    // object arg, which the transform rewrites away; so even in retain mode the
    // now-unreferenced Locale specifier must be pruned (no dead import).
    const result = transform(
      [
        "import { Locale, NextIntlClientProvider } from 'next-intl';",
        "import { getTranslations } from 'next-intl/server';",
        'export default async function Layout({ children }: {',
        '  children: React.ReactNode;',
        '}) {',
        '  const locale = "en";',
        "  const t = await getTranslations({ locale: locale as Locale, namespace: 'Home' });",
        '  return (',
        '    <NextIntlClientProvider>{children}{t("title")}</NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n'),
      { retainProvider: true, dropLocaleValidation: true }
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    // cast dropped by the getTranslations rewrite, so Locale is unreferenced
    expect(result.code).not.toContain('as Locale');
    expect(result.code).not.toMatch(/\bLocale\b/);
    // provider still retained, getTranslations moved to gt-next/server
    expect(result.code).toContain('NextIntlClientProvider');
    expect(result.code).toMatch(
      /import \{[^}]*getTranslations[^}]*\} from ["']gt-next\/server["']/
    );
  });

  it('converts the official-example layout shape (Locale + hasLocale + provider)', () => {
    // dropLocaleValidation mirrors how transformLayoutFile invokes the source
    // pass; hasLocale is tolerated there and the guard is stripped by layout.
    const result = transform(
      [
        "import { Locale, hasLocale, NextIntlClientProvider } from 'next-intl';",
        'export default function Layout({',
        '  children,',
        '  params,',
        '}: {',
        '  children: React.ReactNode;',
        '  params: Promise<{ locale: Locale }>;',
        '}) {',
        '  return (',
        '    <NextIntlClientProvider>{children}</NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n'),
      { dropLocaleValidation: true }
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('GTProvider');
    expect(result.code).not.toContain('NextIntlClientProvider');
    expect(result.code).toMatch(/Promise<\{\s*locale:\s*string;?\s*\}>/);
  });
});

describe('transformLayoutFile: next-intl Locale type', () => {
  it('migrates a [locale] layout that annotates params with Locale', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      [
        "import { Locale, hasLocale, NextIntlClientProvider } from 'next-intl';",
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
        '  params: Promise<{ locale: Locale }>;',
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
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    // core provider swap happened
    expect(result.code).toContain('GTProvider');
    expect(result.code).not.toContain('NextIntlClientProvider');
    // params annotation rewritten
    expect(result.code).toMatch(/Promise<\{\s*locale:\s*string;?\s*\}>/);
    // no residual next-intl imports
    expect(result.code).not.toContain('next-intl');
  });
});
