import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { transformSourceFile } from '../transforms/transformSource.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import type { MigrateIO } from '../pipeline/io.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

// Round 9, class A: every registry that gates a REMOVAL on an identifier name
// instead of the binding it resolves to. Two functions in one file routinely
// destructure the same `locale` out of `params` (a layout component and its
// sibling generateMetadata), so a name-keyed registry protects or deletes the
// wrong one. Each test below drives the real pipeline (runMigration over a real
// tmpdir app) so the assertion covers detection, not just rendering.

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
});

/** A real on-disk next-intl app: the base files plus whatever a case adds. */
function makeApp(extra: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-r9b-'));
  tmpDirs.push(cwd);
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'demo',
      dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
    }),
    'messages/en.json': JSON.stringify({
      Home: { title: 'Welcome' },
      Layout: { title: 'Site' },
      Metadata: { title: 'Portfolio' },
    }),
    'messages/es.json': JSON.stringify({
      Home: { title: 'Bienvenido' },
      Layout: { title: 'Sitio' },
      Metadata: { title: 'Portafolio' },
    }),
    ...extra,
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

async function migrate(cwd: string): Promise<MigrationContext> {
  return runMigration(
    {
      config: 'gt.config.json',
      from: 'next-intl',
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    'next-intl',
    makeIO(),
    cwd
  );
}

function editFor(ctx: MigrationContext, relative: string): string {
  const edit = ctx.edits.find((candidate) =>
    candidate.path.endsWith(path.join(...relative.split('/')))
  );
  expect(edit, `no edit written for ${relative}`).toBeDefined();
  return edit!.content;
}

/**
 * Bindings the emitted file declares and never reads: what
 * `@typescript-eslint/no-unused-vars` reports in the user's project, which is
 * the regression Ernest hit (an unused `locale` in generateMetadata). Limited to
 * the kinds eslint flags for a value declaration; exported functions/classes and
 * type-only material are not unused-variable reports.
 */
function unusedBindings(code: string): string[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const flagged: string[] = [];
  const kinds = new Set(['const', 'let', 'var', 'param', 'module']);
  traverse(ast, {
    Program(programPath) {
      programPath.traverse({
        Scopable(scopePath) {
          const scope = scopePath.scope;
          if (scope.path !== scopePath) return;
          for (const [name, binding] of Object.entries(scope.bindings)) {
            if (!kinds.has(binding.kind)) continue;
            if (binding.referenced) continue;
            // A parameter before a used one cannot be dropped without shifting
            // arity, so eslint's default `args: after-used` ignores it; the only
            // parameters this codemod leaves behind are trailing ones.
            if (binding.kind === 'param') {
              const fn = binding.scope.path.node;
              if (!t.isFunction(fn)) continue;
              const last = fn.params[fn.params.length - 1];
              if (!last || !binding.identifier) continue;
              if (
                !t.isIdentifier(last, { name }) &&
                !(
                  t.isObjectPattern(last) &&
                  last.properties.some(
                    (property) =>
                      t.isObjectProperty(property) &&
                      t.isIdentifier(property.value, { name })
                  )
                )
              ) {
                continue;
              }
            }
            flagged.push(name);
          }
        },
      });
      // Program scope itself is not visited by the traversal above.
      for (const [name, binding] of Object.entries(
        programPath.scope.bindings
      )) {
        if (!kinds.has(binding.kind)) continue;
        if (binding.referenced) continue;
        flagged.push(name);
      }
    },
  });
  return flagged;
}

/** The parameter names bound by `name`'s signature in the emitted code. */
function signatureBindings(code: string, name: string): string[] {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const found: string[] = [];
  traverse(ast, {
    Function(fnPath) {
      const id = t.isFunctionDeclaration(fnPath.node)
        ? fnPath.node.id?.name
        : t.isVariableDeclarator(fnPath.parent) &&
            t.isIdentifier(fnPath.parent.id)
          ? fnPath.parent.id.name
          : null;
      if (id !== name) return;
      for (const param of fnPath.node.params) {
        if (t.isIdentifier(param)) found.push(param.name);
        else if (t.isObjectPattern(param)) {
          for (const property of param.properties) {
            if (
              t.isObjectProperty(property) &&
              t.isIdentifier(property.value)
            ) {
              found.push(property.value.name);
            }
          }
        }
      }
    },
  });
  return found;
}

// The exact shape from the round-9 review: `<html lang={locale}>` in the layout
// component, plus a sibling generateMetadata whose own `locale` destructure goes
// dead because the getTranslations rewrite drops its locale option.
const collisionLayout = [
  "import type { Metadata } from 'next';",
  "import { hasLocale } from 'next-intl';",
  "import { getTranslations } from 'next-intl/server';",
  "import { notFound } from 'next/navigation';",
  "import { routing } from '@/i18n/routing';",
  '',
  'type Props = {',
  '  children: React.ReactNode;',
  '  params: Promise<{ locale: string }>;',
  '};',
  '',
  'export async function generateMetadata({',
  '  params,',
  '}: Props): Promise<Metadata> {',
  '  const { locale } = await params;',
  "  const t = await getTranslations({ locale, namespace: 'Metadata' });",
  "  return { title: t('title') };",
  '}',
  '',
  'export default async function LocaleLayout({ children, params }: Props) {',
  '  const { locale } = await params;',
  '  if (!hasLocale(routing.locales, locale)) {',
  '    notFound();',
  '  }',
  '  return (',
  '    <html lang={locale}>',
  '      <body>{children}</body>',
  '    </html>',
  '  );',
  '}',
].join('\n');

const routingFile = [
  "import { defineRouting } from 'next-intl/routing';",
  'export const routing = defineRouting({',
  "  locales: ['en', 'es'],",
  "  defaultLocale: 'en',",
  '});',
].join('\n');

const homePage = [
  "import { useTranslations } from 'next-intl';",
  'export default function Home() {',
  "  const t = useTranslations('Home');",
  "  return <h1>{t('title')}</h1>;",
  '}',
].join('\n');

describe('round 9: binding identity, not names, gates removals', () => {
  it('drops the dead generateMetadata locale while <html lang={locale}> keeps its own', async () => {
    const ctx = await makeApp({
      'src/app/[locale]/layout.tsx': collisionLayout,
      'src/app/[locale]/page.tsx': homePage,
      'src/i18n/routing.ts': routingFile,
    });
    const result = await migrate(ctx);
    const layout = editFor(result, 'src/app/[locale]/layout.tsx');

    // The regression: an unused `locale` left in generateMetadata.
    expect(unusedBindings(layout)).toEqual([]);
    // generateMetadata's destructure and its params parameter both go.
    expect(signatureBindings(layout, 'generateMetadata')).not.toContain(
      'params'
    );
    // The layout component keeps everything <html lang={locale}> needs
    // (transformLayout.test.ts:957's invariant, re-asserted end to end).
    expect(layout).toMatch(/const \{ locale \} = await params/);
    expect(layout.match(/const \{ locale \} = await params/g)).toHaveLength(1);
    expect(signatureBindings(layout, 'LocaleLayout')).toContain('params');
    expect(layout).toMatch(/<html lang=\{locale\}/);
  });

  it('keeps a sibling function’s own dead params destructure when setRequestLocale goes', async () => {
    // #2 in the class sweep: the removed `setRequestLocale(locale)` orphaned the
    // page's destructure, not generateMetadata's identically named one. The
    // author's own pre-existing dead code is not this codemod's to delete.
    const page = [
      "import { getTranslations, setRequestLocale } from 'next-intl/server';",
      '',
      'type Props = { params: Promise<{ locale: string }> };',
      '',
      'export async function generateMetadata({ params }: Props) {',
      '  const { locale } = await params;',
      "  return { title: 'Static' };",
      '}',
      '',
      'export default async function Page({ params }: Props) {',
      '  const { locale } = await params;',
      '  setRequestLocale(locale);',
      "  const t = await getTranslations('Home');",
      "  return <h1>{t('title')}</h1>;",
      '}',
    ].join('\n');
    const ctx = await makeApp({ 'src/app/[locale]/page.tsx': page });
    const result = await migrate(ctx);
    const emitted = editFor(result, 'src/app/[locale]/page.tsx');

    // Exactly one destructure survives, and it is generateMetadata's.
    expect(emitted.match(/const \{ locale \} = await params/g)).toHaveLength(1);
    expect(signatureBindings(emitted, 'generateMetadata')).toContain('params');
    // The page's own orphan (and its params parameter) still go.
    expect(signatureBindings(emitted, 'Page')).not.toContain('params');
  });

  it('cleans both destructures the codemod orphaned in one file', async () => {
    // next-intl/portfolio's resume page: generateMetadata's `locale` dies with
    // the dropped getTranslations locale option, the page's dies with the removed
    // setRequestLocale. Both orphans are this codemod's, in different scopes, so
    // both go and the emitted file lints clean. (Binding identity alone would
    // clean only the setRequestLocale one and leave a new lint warning behind.)
    const page = [
      "import { getTranslations, setRequestLocale } from 'next-intl/server';",
      '',
      'type Props = { params: Promise<{ locale: string }> };',
      '',
      'export async function generateMetadata({ params }: Props) {',
      '  const { locale } = await params;',
      "  const t = await getTranslations({ locale, namespace: 'Home' });",
      "  return { title: t('title') };",
      '}',
      '',
      'export default async function ResumePage({ params }: Props) {',
      '  const { locale } = await params;',
      '  setRequestLocale(locale);',
      "  const t = await getTranslations('Home');",
      "  return <main>{t('title')}</main>;",
      '}',
    ].join('\n');
    const ctx = await makeApp({ 'src/app/[locale]/resume/page.tsx': page });
    const result = await migrate(ctx);
    const emitted = editFor(result, 'src/app/[locale]/resume/page.tsx');

    expect(emitted).not.toContain('const { locale } = await params');
    expect(signatureBindings(emitted, 'generateMetadata')).not.toContain(
      'params'
    );
    expect(signatureBindings(emitted, 'ResumePage')).not.toContain('params');
    expect(unusedBindings(emitted)).toEqual([]);
  });

  it('cleans a locale destructure orphaned by the getTranslations rewrite alone', async () => {
    // No setRequestLocale anywhere: the dropped locale option is the only thing
    // that killed the reference, and it still has to be cleaned up.
    const page = [
      "import { getTranslations } from 'next-intl/server';",
      '',
      'type Props = { params: Promise<{ locale: string }> };',
      '',
      'export async function generateMetadata({ params }: Props) {',
      '  const { locale } = await params;',
      "  const t = await getTranslations({ locale, namespace: 'Home' });",
      "  return { title: t('title') };",
      '}',
      '',
      'export default async function Page() {',
      "  const t = await getTranslations('Home');",
      "  return <main>{t('title')}</main>;",
      '}',
    ].join('\n');
    const ctx = await makeApp({ 'src/app/[locale]/page.tsx': page });
    const result = await migrate(ctx);
    const emitted = editFor(result, 'src/app/[locale]/page.tsx');

    expect(emitted).not.toContain('const { locale } = await params');
    expect(unusedBindings(emitted)).toEqual([]);
    // The dropped override is still reported, so the change is not silent.
    expect(
      result.todos.some((todo) =>
        /getTranslations locale override dropped/.test(todo.reason)
      )
    ).toBe(true);
  });

  it('resolves a locale option through an `as Locale` cast', async () => {
    const page = [
      "import type { Locale } from 'next-intl';",
      "import { getTranslations } from 'next-intl/server';",
      '',
      'type Props = { params: Promise<{ locale: string }> };',
      '',
      'export async function generateMetadata({ params }: Props) {',
      '  const { locale } = await params;',
      '  const t = await getTranslations({',
      '    locale: locale as Locale,',
      "    namespace: 'Home',",
      '  });',
      "  return { title: t('title') };",
      '}',
      '',
      'export default async function Page() {',
      "  const t = await getTranslations('Home');",
      "  return <main>{t('title')}</main>;",
      '}',
    ].join('\n');
    const ctx = await makeApp({ 'src/app/[locale]/page.tsx': page });
    const result = await migrate(ctx);
    const emitted = editFor(result, 'src/app/[locale]/page.tsx');

    expect(emitted).not.toContain('const { locale } = await params');
    expect(unusedBindings(emitted)).toEqual([]);
  });

  it('prunes only the guard array the removed guard resolved to', async () => {
    // #3 in the class sweep: a same-named, unreferenced const in another scope
    // is a different declarator and must survive.
    const layout = [
      "import { getTranslations } from 'next-intl/server';",
      "import { notFound } from 'next/navigation';",
      '',
      'export function helperWidget() {',
      "  const supportedLocales = ['en', 'es'];",
      '  return null;',
      '}',
      '',
      'export default async function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: Promise<{ locale: string }>;',
      '}) {',
      "  const supportedLocales = ['en', 'es'];",
      '  const { locale } = await params;',
      '  if (!supportedLocales.includes(locale)) {',
      '    notFound();',
      '  }',
      "  const t = await getTranslations('Layout');",
      '  return (',
      '    <html lang={locale}>',
      "      <body>{t('title')}{children}</body>",
      '    </html>',
      '  );',
      '}',
    ].join('\n');
    const ctx = await makeApp({
      'src/app/[locale]/layout.tsx': layout,
      'src/app/[locale]/page.tsx': homePage,
    });
    const result = await migrate(ctx);
    const emitted = editFor(result, 'src/app/[locale]/layout.tsx');

    // The guard is gone with its own array ...
    expect(emitted).not.toContain('supportedLocales.includes');
    // ... and helperWidget keeps its identically named const.
    expect(emitted.match(/const supportedLocales = \[/g)).toHaveLength(1);
    expect(emitted).toMatch(
      /function helperWidget\(\) \{\s*const supportedLocales/
    );
  });

  it('keeps a messages hook import that only a local shadow appeared to strand', () => {
    // #7 in the class sweep. Both sides of the old comparison were plain names,
    // so a local shadow named getMessages could take the real import specifier
    // with it. Direct transform call: the consumer of that registry only runs in
    // retained-provider mode, and the provider-swap that populates it is
    // disabled in that mode, so the pipeline cannot reach the difference today
    // (this pins the invariant the fix makes structural).
    const catalogs: MessageCatalogs = {
      defaultLocale: 'en',
      locales: ['en', 'es'],
      byLocale: { en: {}, es: {} },
      dir: '/project/messages',
    };
    const routing: RoutingInfo = {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
    };
    const ctx: MigrationContext = {
      cwd: '/project',
      catalogs,
      routing,
      edits: [],
      todos: [],
      skippedFiles: new Map([['src/components/Price.tsx', ['reason']]]),
      stats: {},
      adapter: nextIntlAdapter,
    };
    const source = [
      "import { NextIntlClientProvider } from 'next-intl';",
      "import { getMessages } from 'next-intl/server';",
      '',
      'export async function Shell({ children }: { children: React.ReactNode }) {',
      '  const messages = await getMessages();',
      '  return (',
      '    <NextIntlClientProvider messages={messages}>',
      '      {children}',
      '    </NextIntlClientProvider>',
      '  );',
      '}',
    ].join('\n');
    const result = transformSourceFile(
      'src/components/Shell.tsx',
      source,
      ctx,
      { retainProvider: true }
    );
    expect(result.skipReasons).toEqual([]);
    // Partial mode keeps the provider and the hook that feeds it.
    expect(result.code ?? source).toContain('getMessages');
  });
});
