import { describe, expect, it } from 'vitest';
import { transformSourceFile } from '../transformSource.js';
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

function makeContext(messages: Record<string, unknown> = {}): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: messages, es: {} },
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

function transform(code: string, messages: Record<string, unknown> = {}) {
  return transformSourceFile('src/app/page.tsx', code, makeContext(messages));
}

describe('transformSourceFile: imports and hooks', () => {
  it('returns unchanged for files without next-intl imports', () => {
    const result = transform(`export function x() { return 1; }`);
    expect(result.code).toBeNull();
    expect(result.skipReasons).toEqual([]);
  });

  it('swaps useTranslations and useLocale to gt-next', () => {
    const result = transform(
      [
        "import { useTranslations, useLocale } from 'next-intl';",
        'export function Page() {',
        "  const t = useTranslations('Home');",
        '  const locale = useLocale();',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(
      /import \{ useTranslations, useLocale \} from ["']gt-next["']/
    );
    expect(result.code).not.toMatch(/["']next-intl["']/);
    expect(result.code).toContain("const t = useTranslations('Home')");
  });

  it('preserves import aliases', () => {
    const result = transform(
      [
        "import { useTranslations as useT } from 'next-intl';",
        'export function Page() {',
        "  const t = useT('Home');",
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n')
    );
    expect(result.code).toMatch(
      /import \{ useTranslations as useT \} from ["']gt-next["']/
    );
  });

  it('swaps server imports to gt-next/server', () => {
    const result = transform(
      [
        "import { getTranslations, getLocale } from 'next-intl/server';",
        'export async function Page() {',
        "  const t = await getTranslations('Home');",
        '  const locale = await getLocale();',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.code).toMatch(
      /import \{ getTranslations, getLocale \} from ["']gt-next\/server["']/
    );
    expect(result.code).not.toContain('next-intl/server');
  });

  it('merges into an existing gt-next import', () => {
    const result = transform(
      [
        "import { T } from 'gt-next';",
        "import { useTranslations } from 'next-intl';",
        'export function Page() {',
        "  const t = useTranslations('Home');",
        '  return (',
        '    <T>',
        '      <p>static</p>',
        '    </T>',
        '  );',
        '}',
      ].join('\n')
    );
    expect(result.code).toMatch(
      /import \{ T,\s*useTranslations \} from ["']gt-next["']/
    );
  });

  it('rewrites getTranslations object arg to namespace string', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page() {',
        "  const t = await getTranslations({ locale: 'en', namespace: 'Home' });",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.code).toMatch(/await getTranslations\(["']Home["']\)/);
    expect(result.todos.some((todo) => todo.reason.includes('locale'))).toBe(
      true
    );
  });

  it('removes setRequestLocale imports and calls', () => {
    const result = transform(
      [
        "import { getTranslations, setRequestLocale } from 'next-intl/server';",
        'export default async function Page({ params }: { params: { locale: string } }) {',
        '  setRequestLocale(params.locale);',
        "  const t = await getTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.code).not.toContain('setRequestLocale');
    expect(result.code).toMatch(
      /import \{ getTranslations \} from ["']gt-next\/server["']/
    );
  });

  it('keeps dynamic keys working in dictionary mode without skipping', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        'export function Item({ id }: { id: string }) {',
        "  const t = useTranslations('Items');",
        '  return <p>{t(`entry.${id}`)}</p>;',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('t(`entry.${id}`)');
  });
});

describe('transformSourceFile: provider', () => {
  it('replaces NextIntlClientProvider with GTProvider and drops props', () => {
    const result = transform(
      [
        "import { NextIntlClientProvider, useMessages } from 'next-intl';",
        'export function Providers({ children }: { children: React.ReactNode }) {',
        '  const messages = useMessages();',
        '  return (',
        '    <NextIntlClientProvider messages={messages} locale="en">',
        '      {children}',
        '    </NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('<GTProvider>');
    expect(result.code).toContain('</GTProvider>');
    expect(result.code).not.toContain('NextIntlClientProvider');
    expect(result.code).not.toContain('useMessages');
    expect(result.code).toMatch(/import \{ GTProvider \} from ["']gt-next["']/);
    // messages and locale are absorbed by the swap; nothing else was dropped
    expect(result.todos).toEqual([]);
  });

  it('records a TODO naming provider props the swap drops', () => {
    const result = transform(
      [
        "import { NextIntlClientProvider, useMessages } from 'next-intl';",
        'export function Providers({ children }: { children: React.ReactNode }) {',
        '  const messages = useMessages();',
        '  return (',
        '    <NextIntlClientProvider',
        '      messages={messages}',
        '      timeZone="Europe/Vienna"',
        '      onError={console.error}',
        '    >',
        '      {children}',
        '    </NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('<GTProvider>');
    const reasons = result.todos.map((todo) => todo.reason).join(' ');
    expect(reasons).toContain('timeZone');
    expect(reasons).toContain('onError');
    expect(reasons).toContain('GTProvider swap');
  });

  it('drops a getLocale binding that only fed the stripped provider locale', () => {
    const result = transform(
      [
        "import { NextIntlClientProvider } from 'next-intl';",
        "import { getLocale, getMessages } from 'next-intl/server';",
        'export default async function Providers({',
        '  children,',
        '}: {',
        '  children: React.ReactNode;',
        '}) {',
        '  const locale = await getLocale();',
        '  const messages = await getMessages();',
        '  return (',
        '    <NextIntlClientProvider locale={locale} messages={messages}>',
        '      {children}',
        '    </NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('<GTProvider>');
    // both stranded bindings and the now-dead getLocale import are gone
    expect(result.code).not.toContain('getLocale');
    expect(result.code).not.toContain('const locale');
    expect(result.code).not.toContain('getMessages');
  });

  it('keeps a getLocale binding that is still read outside the provider', () => {
    const result = transform(
      [
        "import { NextIntlClientProvider } from 'next-intl';",
        "import { getLocale } from 'next-intl/server';",
        'export default async function Providers({',
        '  children,',
        '}: {',
        '  children: React.ReactNode;',
        '}) {',
        '  const locale = await getLocale();',
        '  return (',
        '    <NextIntlClientProvider locale={locale}>',
        '      <div lang={locale}>{children}</div>',
        '    </NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // the div still reads locale, so the binding and swapped import survive
    expect(result.code).toContain('const locale = await getLocale()');
    expect(result.code).toMatch(
      /import \{\s*getLocale\s*\} from ["']gt-next\/server["']/
    );
  });

  it('skips when the messages binding is also used outside the provider', () => {
    const result = transform(
      [
        "import { NextIntlClientProvider, useMessages } from 'next-intl';",
        "import { Child } from './Child';",
        'export function Providers({ children }: { children: React.ReactNode }) {',
        '  const messages = useMessages();',
        '  return (',
        '    <NextIntlClientProvider messages={messages}>',
        '      <Child messages={messages} />',
        '      {children}',
        '    </NextIntlClientProvider>',
        '  );',
        '}',
      ].join('\n')
    );
    // removing the declaration would leave <Child messages={messages} /> dangling
    expect(result.skipReasons).not.toEqual([]);
  });
});

describe('transformSourceFile: skip conditions', () => {
  it('skips files using useFormatter', () => {
    const result = transform(
      [
        "import { useFormatter } from 'next-intl';",
        'export function Price({ value }: { value: number }) {',
        '  const format = useFormatter();',
        '  return <span>{format.number(value)}</span>;',
        '}',
      ].join('\n')
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('useFormatter');
  });

  it('skips files using useMessages outside a provider prop', () => {
    const result = transform(
      [
        "import { useMessages } from 'next-intl';",
        'export function Dump() {',
        '  const messages = useMessages();',
        '  return <pre>{JSON.stringify(messages)}</pre>;',
        '}',
      ].join('\n')
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('useMessages');
  });

  it('skips files using t.raw', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        'export function Terms() {',
        "  const t = useTranslations('Legal');",
        "  const clauses = t.raw('clauses');",
        '  return <div>{clauses.length}</div>;',
        '}',
      ].join('\n')
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('t.raw');
  });

  it('skips files with unknown next-intl imports', () => {
    const result = transform(
      [
        "import { useSomethingNew } from 'next-intl';",
        'export function X() { return useSomethingNew(); }',
      ].join('\n')
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('useSomethingNew');
  });
});

describe('transformSourceFile: t.rich', () => {
  it('always skips t.rich — conversion would discard existing translations', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        'export function Welcome() {',
        "  const t = useTranslations('Home');",
        "  return <div>{t.rich('welcome', { b: (chunks) => <b>{chunks}</b> })}</div>;",
        '}',
      ].join('\n'),
      { Home: { welcome: 'Hi <b>friend</b>!' } }
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons).toContain(
      't.rich(...) conversion would discard existing translations for the key; convert it manually'
    );
  });

  it('skips t.rich even for a message that mixes tags and arguments', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        'export function Welcome({ name }: { name: string }) {',
        "  const t = useTranslations('Home');",
        "  return <div>{t.rich('welcome', { b: (chunks) => <b>{chunks}</b>, name })}</div>;",
        '}',
      ].join('\n'),
      { Home: { welcome: 'Hi <b>{name}</b>' } }
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toContain('convert it manually');
  });
});

describe('re-exports from next-intl', () => {
  it('skips a file that re-exports from next-intl alongside supported imports', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        "export { Locale } from 'next-intl';",
        'export function Title() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      { Home: { title: 'Hello' } }
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join('\n')).toContain(
      "re-export from 'next-intl'"
    );
  });

  it('skips a file whose only next-intl usage is a type re-export', () => {
    const result = transform("export type { Locale } from 'next-intl';\n");
    expect(result).not.toBeNull();
    expect(result.code).toBeNull();
    expect(result.skipReasons.join('\n')).toContain(
      "re-export from 'next-intl'"
    );
  });

  it('skips export-all from next-intl', () => {
    const result = transform("export * from 'next-intl/server';\n");
    expect(result.code).toBeNull();
    expect(result.skipReasons.join('\n')).toContain(
      "re-export from 'next-intl/server'"
    );
  });

  it('ignores re-exports from unrelated modules', () => {
    const result = transform(
      [
        "import { useTranslations } from 'next-intl';",
        "export { helper } from './helper';",
        'export function Title() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      { Home: { title: 'Hello' } }
    );
    expect(result.code).not.toBeNull();
    expect(result.skipReasons).toEqual([]);
  });
});

describe('transformSourceFile: dynamic getTranslations namespace', () => {
  it('preserves an identifier namespace as a positional argument', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page({ locale, ns }: { locale: string; ns: string }) {',
        '  const t = await getTranslations({ locale, namespace: ns });',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/await getTranslations\(ns\)/);
    expect(result.todos.some((todo) => todo.reason.includes('locale'))).toBe(
      true
    );
  });

  it('preserves a call-expression namespace', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page() {',
        '  const t = await getTranslations({ namespace: getNs() });',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toMatch(/await getTranslations\(getNs\(\)\)/);
  });

  it('preserves a template-literal namespace', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page({ section }: { section: string }) {',
        '  const t = await getTranslations({ namespace: `Admin.${section}` });',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('getTranslations(`Admin.${section}`)');
  });

  it('still drops a locale-only object arg to getTranslations()', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page() {',
        "  const t = await getTranslations({ locale: 'en' });",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('await getTranslations()');
    expect(result.todos.some((todo) => todo.reason.includes('locale'))).toBe(
      true
    );
  });

  it('skips a spread-only object arg to getTranslations', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page() {',
        '  const t = await getTranslations({ ...opts });',
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    // The spread may carry namespace/locale; converting would silently drop it.
    expect(result.code).toBeNull();
    expect(result.skipReasons.some((reason) => reason.includes('spread'))).toBe(
      true
    );
  });

  it('skips a spread + literal namespace instead of a silent partial rewrite', () => {
    const result = transform(
      [
        "import { getTranslations } from 'next-intl/server';",
        'export async function Page() {',
        "  const t = await getTranslations({ ...base, namespace: 'Home' });",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.some((reason) => reason.includes('spread'))).toBe(
      true
    );
  });
});

describe('transformSourceFile: orphaned param-locale cleanup', () => {
  it('drops the destructure, params, and use import stranded by setRequestLocale removal', () => {
    const result = transform(
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function AboutPage({ params }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = use(params);',
        '  setRequestLocale(locale);',
        "  const t = useTranslations('AboutPage');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('setRequestLocale');
    // orphaned destructure gone
    expect(result.code).not.toContain('use(params)');
    expect(result.code).not.toMatch(/const \{ locale \}/);
    // sole `{ params }` param removed whole (its annotation goes with it)
    expect(result.code).toMatch(/function AboutPage\(\)/);
    // `use` import pruned once its last reference is gone
    expect(result.code).not.toMatch(/from ["']react["']/);
  });

  it('leaves a surviving sibling param and its type member untouched', () => {
    // Multi-property param: `params` is spliced from the pattern but its type
    // member stays (an unused type member does not lint), so the annotation is
    // untouched — the "types never touched" contract.
    const result = transform(
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params, searchParams }: {',
        '  params: Promise<{ locale: string }>;',
        '  searchParams: Promise<Record<string, string>>;',
        '}) {',
        '  const { locale } = use(params);',
        '  setRequestLocale(locale);',
        '  const sp = use(searchParams);',
        "  const t = useTranslations('Home');",
        "  return <h1>{sp.q}{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // runtime params destructure gone, searchParams destructure kept
    expect(result.code).not.toMatch(/const \{ locale \}/);
    expect(result.code).toContain('use(searchParams)');
    // params property spliced from the pattern, searchParams retained
    expect(result.code).toMatch(/\{\s*searchParams\s*\}/);
    // `use` import kept, still referenced by use(searchParams)
    expect(result.code).toMatch(/import \{ use \} from ["']react["']/);
    // the params type member is left in place, not surgically edited
    expect(result.code).toMatch(
      /params:\s*Promise<\{\s*locale:\s*string;?\s*\}>/
    );
  });

  it('cleans an `await params` destructure in an async page', () => {
    const result = transform(
      [
        "import { getTranslations, setRequestLocale } from 'next-intl/server';",
        'export default async function Page({ params }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = await params;',
        '  setRequestLocale(locale);',
        "  const t = await getTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('setRequestLocale');
    expect(result.code).not.toContain('await params');
    expect(result.code).not.toMatch(/const \{ locale \}/);
    expect(result.code).toMatch(/async function Page\(\)/);
    expect(result.code).toMatch(
      /import \{ getTranslations \} from ["']gt-next\/server["']/
    );
  });

  it('keeps everything when locale is still referenced elsewhere', () => {
    const result = transform(
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = use(params);',
        '  setRequestLocale(locale);',
        "  const t = useTranslations('Home');",
        "  return <h1 lang={locale}>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toContain('setRequestLocale');
    // locale is still read by <h1 lang={locale}>, so nothing is removed
    expect(result.code).toContain('const { locale } = use(params)');
    expect(result.code).toMatch(/Page\(\{ params \}/);
    expect(result.code).toMatch(/import \{ use \} from ["']react["']/);
  });

  it('keeps a destructure whose second binding is still used', () => {
    const result = transform(
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {',
        '  const { locale, slug } = use(params);',
        '  setRequestLocale(locale);',
        "  const t = useTranslations('Home');",
        "  return <article data-slug={slug}>{t('title')}</article>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // slug is still used, so the whole declaration (and params) stay
    expect(result.code).toContain('const { locale, slug } = use(params)');
    expect(result.code).toMatch(/Page\(\{ params \}/);
    expect(result.code).toMatch(/import \{ use \} from ["']react["']/);
  });

  it('keeps the params parameter when a rest sibling would absorb it', () => {
    const result = transform(
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params, ...rest }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = use(params);',
        '  setRequestLocale(locale);',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // the orphaned destructure is still removed
    expect(result.code).not.toContain('use(params)');
    // but the params PARAMETER stays: a rest sibling would absorb the key
    expect(result.code).toMatch(/params,\s*\.\.\.rest/);
  });

  it('leaves an already-dead destructure alone when no setRequestLocale ran', () => {
    const result = transform(
      [
        "import { use } from 'react';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = use(params);',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n')
    );
    expect(result.skipReasons).toEqual([]);
    // no setRequestLocale removal ran, so the author's own dead code stays
    expect(result.code).toContain('const { locale } = use(params)');
    expect(result.code).toMatch(/Page\(\{ params \}/);
    expect(result.code).toMatch(/import \{ use \} from ["']react["']/);
  });

  it('leaves the orphan alone when dropOrphanedParamLocale is false (layout contract)', () => {
    const result = transformSourceFile(
      'src/app/page.tsx',
      [
        "import { use } from 'react';",
        "import { setRequestLocale } from 'next-intl/server';",
        "import { useTranslations } from 'next-intl';",
        'export default function Page({ params }: { params: Promise<{ locale: string }> }) {',
        '  const { locale } = use(params);',
        '  setRequestLocale(locale);',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      makeContext(),
      { dropOrphanedParamLocale: false }
    );
    expect(result.skipReasons).toEqual([]);
    // setRequestLocale is still removed regardless of the option
    expect(result.code).not.toContain('setRequestLocale');
    // but the orphaned destructure, params, and use import are all preserved
    expect(result.code).toContain('const { locale } = use(params)');
    expect(result.code).toMatch(/Page\(\{ params \}/);
    expect(result.code).toMatch(/import \{ use \} from ["']react["']/);
  });
});
