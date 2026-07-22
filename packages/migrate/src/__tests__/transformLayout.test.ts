import { describe, expect, it } from 'vitest';
import { transformLayoutFile } from '../transforms/transformLayout.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import { reactIntlAdapter } from '../adapters/reactIntl.js';

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

  it('keeps a subset launch gate tested against the locale param', () => {
    const withSubsetGate = localeLayout.replace(
      '  setRequestLocale(locale);',
      [
        "  const LAUNCHED = ['en'];",
        '  if (!LAUNCHED.includes(locale)) {',
        '    notFound();',
        '  }',
        '  setRequestLocale(locale);',
      ].join('\n')
    );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withSubsetGate,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // the full-set hasLocale guard goes, the deliberate subset gate stays
    expect(result.code).not.toContain('hasLocale');
    expect(result.code).toContain('LAUNCHED.includes(locale)');
    expect(result.code).toContain('notFound()');
    expect(
      result.todos.some((todo) => todo.reason.includes('locale guard kept'))
    ).toBe(true);
  });

  it('removes a shuffled full-set const guard and prunes the dead array', () => {
    const withFullSetGuard = localeLayout
      .replace(
        'if (!hasLocale(routing.locales, locale)) {',
        'if (!ORDERED.includes(locale)) {'
      )
      .replace(
        "import { hasLocale } from 'next-intl';",
        "const ORDERED = ['es', 'en'];"
      );
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withFullSetGuard,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('ORDERED.includes');
    // the guard was the array's only consumer, so the array goes with it
    expect(result.code).not.toContain('const ORDERED');
    expect(result.code).not.toContain('notFound()');
  });

  it('names the retained provider for the adapter in a client layout', () => {
    const clientIntlLayout = [
      "'use client';",
      "import { IntlProvider } from 'react-intl';",
      'export default function SectionLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return (',
      '    <IntlProvider locale="en" messages={{}}>',
      '      <section>{children}</section>',
      '    </IntlProvider>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/section/layout.tsx',
      clientIntlLayout,
      {
        ...makeContext(['src/components/Skipped.tsx']),
        adapter: reactIntlAdapter,
      }
    );
    expect(result.skipReasons).toEqual([]);
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('client-component layout keeps IntlProvider')
      )
    ).toBe(true);
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
    // retained provider gets the resolved locale explicitly; via the static
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

  it('does not inject an out-of-scope param locale from generateMetadata (uses the getLocale fallback)', () => {
    // generateMetadata destructures the param locale, but the default-exported
    // component does not; so `locale` is NOT in scope at the provider inside
    // the component. The file-wide binding must not leak in as `locale={locale}`
    // (an undefined reference); the component is async, so the request-scoped
    // fallback applies instead.
    const metadataOnlyLocale = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export async function generateMetadata({',
      '  params,',
      '}: {',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  return { title: locale };',
      '}',
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
      metadataOnlyLocale,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // the generateMetadata `locale` is out of scope here, so it is not injected
    expect(result.code).not.toContain('locale={locale}');
    // the component is async and default-exported, so getLocale() is safe
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{await getLocale\(\)\}/
    );
    expect(result.code).toMatch(
      /import \{[^}]*getLocale[^}]*\} from ["']gt-next\/server["']/
    );
  });

  it('skips instead of injecting an out-of-scope param locale into a sync helper', () => {
    // Same out-of-scope generateMetadata binding, but the provider now sits in
    // a synchronous helper. The old file-wide lookup would inject the
    // out-of-scope `locale`; the fix resolves scope, finds none, and (unable to
    // make the sync helper async safely) degrades to a manual-wiring skip.
    const metadataLocaleSyncHelper = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export async function generateMetadata({',
      '  params,',
      '}: {',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  return { title: locale };',
      '}',
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
      metadataLocaleSyncHelper,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([
      'retained NextIntlClientProvider has no route `locale` param in scope and sits inside a synchronous helper that cannot be made async safely; pass its `locale` prop manually (the layout keeps working on next-intl until then)',
    ]);
  });

  it('injects the param locale when the component itself destructures it (regression)', () => {
    const componentLocaleLayout = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
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
      componentLocaleLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{locale\}/
    );
    expect(result.code).not.toContain('getLocale()');
  });

  it('injects the aliased param locale when the component destructures it (regression)', () => {
    const aliasLocaleLayout = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale: lng } = await params;',
      '  const messages = await getMessages();',
      '  return (',
      '    <html lang={lng}>',
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
      aliasLocaleLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/<NextIntlClientProvider[^>]*locale=\{lng\}/);
    expect(result.code).not.toContain('getLocale()');
  });

  it('leaves client-component layouts alone and flags the retained provider', () => {
    const clientLayout = [
      "'use client';",
      "import { NextIntlClientProvider } from 'next-intl';",
      'export default function SectionLayout({',
      '  children,',
      '  messages,',
      '}: {',
      '  children: React.ReactNode;',
      '  messages: Record<string, string>;',
      '}) {',
      '  return (',
      '    <NextIntlClientProvider messages={messages}>',
      '      {children}',
      '    </NextIntlClientProvider>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/section/layout.tsx',
      clientLayout,
      makeContext(['src/components/Skipped.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // server-only injections must not land in a client component
    expect(result.code ?? clientLayout).not.toContain('await getLocale()');
    expect(result.code ?? clientLayout).not.toContain('async function');
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('client-component layout')
      )
    ).toBe(true);
  });

  it('flags a client layout that renders body instead of editing it', () => {
    const clientRootLayout = [
      "'use client';",
      'export default function LocaleLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      clientRootLayout,
      makeContext()
    );
    expect(result.code ?? clientRootLayout).not.toContain('GTProvider>');
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('client components are left alone')
      )
    ).toBe(true);
  });

  it('reports when GTProvider cannot be inserted in the root locale layout', () => {
    const noBodyLayout = [
      'export default function LocaleLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return <main>{children}</main>;',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      noBodyLayout,
      makeContext()
    );
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('GTProvider was not added')
      )
    ).toBe(true);
  });

  it('stays quiet about GTProvider in nested layouts without a body', () => {
    const nestedLayout = [
      'export default function GroupLayout({',
      '  children,',
      '}: {',
      '  children: React.ReactNode;',
      '}) {',
      '  return <section>{children}</section>;',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/(shop)/layout.tsx',
      nestedLayout,
      makeContext()
    );
    expect(
      result.todos.some((todo) =>
        todo.reason.includes('GTProvider was not added')
      )
    ).toBe(false);
  });

  // The parameter destructure of a function `Name({ ... }: { ...types... })`
  // sits between `Name({` and the first `}:`. Capturing it lets a test assert
  // on the runtime bindings without matching the type members that follow.
  function signatureBindings(code: string, fnName: string): string {
    const match = code.match(new RegExp(`${fnName}\\(\\{([\\s\\S]*?)\\}:`));
    expect(match).not.toBeNull();
    return match![1];
  }

  it('drops the orphaned params parameter after removing a static-lang locale guard', () => {
    const staticLangLayout = [
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
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      staticLangLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // the guard is gone, so the destructure that only fed it is removed ...
    expect(result.code).not.toContain('await params');
    expect(result.code).not.toContain('const { locale }');
    // ... and the now-unreferenced params binding is gone from the signature
    const bindings = signatureBindings(result.code!, 'LocaleLayout');
    expect(bindings).toContain('children');
    expect(bindings).not.toContain('params');
    // the TypeScript annotation is intentionally left in place: an unused type
    // member does not lint, and rewriting the type risks breaking it
    expect(result.code).toMatch(
      /params:\s*Promise<\{\s*locale:\s*string;?\s*\}>/
    );
  });

  it('keeps params when a rest element shares the parameter pattern', () => {
    // Removing the property would change what `...rest` absorbs at runtime
    // (it would gain a `params` key), so the cleanup must leave it alone.
    const restLayout = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '  ...rest',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang="en" {...rest}>',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      restLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // the orphaned destructure still goes ...
    expect(result.code).not.toContain('await params');
    // ... but params stays in the signature so rest keeps excluding it
    const bindings = signatureBindings(result.code!, 'LocaleLayout');
    expect(bindings).toContain('params');
    expect(bindings).toContain('...rest');
  });

  it('cleans an orphaned use(params) destructure and its react import', () => {
    const useParamsLayout = [
      "import { use } from 'react';",
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = use(params);',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      useParamsLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // guard, destructure, params binding, and the stranded use import all go
    expect(result.code).not.toContain('use(params)');
    expect(result.code).not.toMatch(/import \{\s*use\s*\} from ["']react["']/);
    const bindings = signatureBindings(result.code!, 'LocaleLayout');
    expect(bindings).not.toContain('params');
  });

  it('feeds a retained provider from a use(params) locale binding', () => {
    const useParamsProviderLayout = [
      "import { use } from 'react';",
      "import { NextIntlClientProvider, hasLocale } from 'next-intl';",
      "import { notFound } from 'next/navigation';",
      "import { routing } from '@/i18n/routing';",
      'export default function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = use(params);',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang={locale}>',
      '      <body>',
      '        <NextIntlClientProvider>{children}</NextIntlClientProvider>',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      useParamsProviderLayout,
      makeContext(['src/components/Price.tsx'])
    );
    expect(result.skipReasons).toEqual([]);
    // the static use(params) binding feeds the provider, not a request-scoped
    // getLocale(), and the still-referenced use import survives
    expect(result.code).toMatch(
      /<NextIntlClientProvider[^>]*locale=\{locale\}/
    );
    expect(result.code).not.toContain('getLocale()');
    expect(result.code).toMatch(/import \{\s*use\s*\} from ["']react["']/);
  });

  it('keeps params in the signature when <html lang={locale}> still uses it', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      localeLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // dynamic lang keeps the destructure, so the params binding must stay too
    expect(result.code).toContain('const { locale } = await params');
    expect(signatureBindings(result.code!, 'LocaleLayout')).toContain('params');
  });

  it('keeps params when a second destructure of it survives', () => {
    const twoDestructures = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string; slug: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  const { slug } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang="en" data-slug={slug}>',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      twoDestructures,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // the locale guard is gone, so its destructure is removed ...
    expect(result.code).not.toContain('const { locale }');
    // ... but slug still reads params, so params stays bound
    expect(result.code).toContain('const { slug } = await params');
    expect(signatureBindings(result.code!, 'LocaleLayout')).toContain('params');
  });

  it('keeps params when it is still passed to a child', () => {
    const passesParams = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      "import { Analytics } from './Analytics';",
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
      '  return (',
      '    <html lang="en">',
      '      <body>',
      '        <Analytics params={params} />',
      '        {children}',
      '      </body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      passesParams,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('const { locale }');
    // params is still handed to the child, so it must stay bound
    expect(result.code).toContain('params={params}');
    expect(signatureBindings(result.code!, 'LocaleLayout')).toContain('params');
  });

  it('leaves a sibling generateMetadata params untouched while cleaning the component', () => {
    const withMetadata = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export async function generateMetadata({',
      '  params,',
      '}: {',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  return { title: locale };',
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
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      withMetadata,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    // generateMetadata still reads its own params, so both survive there
    expect(result.code).toContain('return { title: locale }');
    expect(signatureBindings(result.code!, 'generateMetadata')).toContain(
      'params'
    );
    // the component's params, orphaned by guard removal, is dropped
    expect(signatureBindings(result.code!, 'LocaleLayout')).not.toContain(
      'params'
    );
  });

  it('removes the whole parameter when params is the only destructured property', () => {
    const onlyParams = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'export default async function LocaleLayout({',
      '  params,',
      '}: {',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang="en">',
      '      <body />',
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      onlyParams,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('const { locale }');
    expect(result.code).not.toContain('await params');
    // removing the sole property would leave an empty destructure, so the whole
    // last parameter is dropped: the signature takes no arguments
    expect(result.code).toMatch(/LocaleLayout\(\s*\)/);
  });

  it('drops the orphaned params parameter from an arrow-function component', () => {
    const arrowLayout = [
      "import { notFound } from 'next/navigation';",
      "import { hasLocale } from 'next-intl';",
      "import { routing } from '@/i18n/routing';",
      'const LocaleLayout = async ({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) => {',
      '  const { locale } = await params;',
      '  if (!hasLocale(routing.locales, locale)) {',
      '    notFound();',
      '  }',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '};',
      'export default LocaleLayout;',
    ].join('\n');
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      arrowLayout,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('const { locale }');
    expect(result.code).not.toContain('await params');
    // the cleanup is function-shape agnostic: the arrow's params binding goes too
    const bindings = result.code!.match(/async \(\{([\s\S]*?)\}:/);
    expect(bindings).not.toBeNull();
    expect(bindings![1]).toContain('children');
    expect(bindings![1]).not.toContain('params');
  });
});
