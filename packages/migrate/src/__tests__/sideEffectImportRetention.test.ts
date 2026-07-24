import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import type * as t from '@babel/types';
import { removeUnusedNamedImports } from '../transforms/importUtils.js';
import { transformLayoutFile } from '../transforms/transformLayout.js';
import { transformNavigationFile } from '../transforms/transformNavigation.js';
import { transformSourceFile } from '../transforms/transformSource.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import { reactIntlAdapter } from '../adapters/reactIntl.js';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import type { SourceAdapter } from '../adapters/types.js';

const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(
  adapter: SourceAdapter = nextIntlAdapter
): MigrationContext {
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
    adapter,
  };
}

function parseFile(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  }) as unknown as t.File;
}

describe('removeUnusedNamedImports: side-effect import retention', () => {
  it('retains a pre-existing side-effect import while removing an emptied declaration', () => {
    const ast = parseFile(
      [
        "import './globals.css';",
        "import { setRequestLocale } from 'next-intl/server';",
        'export const x = 1;',
      ].join('\n')
    );
    removeUnusedNamedImports(ast, ['setRequestLocale']);
    const out = generate(ast).code;
    expect(out).toContain("import './globals.css'");
    expect(out).not.toContain('next-intl/server');
  });

  it('retains a side-effect import even when it is the only import', () => {
    const ast = parseFile(
      ["import './globals.css';", 'export const x = 1;'].join('\n')
    );
    removeUnusedNamedImports(ast, ['unusedName']);
    const out = generate(ast).code;
    expect(out).toContain("import './globals.css'");
  });

  it('still removes a declaration whose specifiers were all pruned', () => {
    const ast = parseFile(
      ["import { a, b } from 'mod';", 'export const x = 1;'].join('\n')
    );
    removeUnusedNamedImports(ast, ['a', 'b']);
    const out = generate(ast).code;
    expect(out).not.toContain("'mod'");
  });

  it('keeps a declaration when some tracked specifiers are still referenced', () => {
    const ast = parseFile(
      ["import { a, b } from 'mod';", 'export const x = a;'].join('\n')
    );
    removeUnusedNamedImports(ast, ['a', 'b']);
    const out = generate(ast).code;
    expect(out).toContain("import { a } from 'mod'");
  });
});

describe('transformLayoutFile: side-effect import retention', () => {
  // Includes a removable hasLocale guard and routing import so the layout
  // pass genuinely runs removeUnusedNamedImports (the deletion path Ernest
  // hit in the field); a fixture without prunable imports would pass even
  // without the guard in importUtils.
  const layoutWithGlobals = [
    "import './globals.css';",
    "import { NextIntlClientProvider, hasLocale } from 'next-intl';",
    "import { getMessages, setRequestLocale } from 'next-intl/server';",
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

  it('keeps import "./globals.css" while the cleanup prunes emptied imports', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      layoutWithGlobals,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    expect(result.code).toContain('<GTProvider>');
    // the emptied guard imports are pruned, proving the cleanup pass ran...
    expect(result.code).not.toContain('hasLocale');
    expect(result.code).not.toContain('@/i18n/routing');
    // ...and the pre-existing stylesheet import survived it
    expect(result.code).toContain("import './globals.css'");
  });
});

describe('transformNavigationFile: side-effect import retention', () => {
  const navigationWrapper = [
    "import 'server-only';",
    "import { createNavigation } from 'next-intl/navigation';",
    "import { routing } from './routing';",
    'export const { Link, redirect, usePathname, useRouter } =',
    '  createNavigation(routing);',
  ].join('\n');

  it('reconstructs pre-existing side-effect imports in the regenerated wrapper', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      navigationWrapper,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    expect(result.code).toContain("import 'server-only';");
  });

  it('does not turn a zero-specifier type-only import into a runtime import', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      [
        "import type {} from './types';",
        "import { createNavigation } from 'next-intl/navigation';",
        "import { routing } from './routing';",
        'export const { Link } = createNavigation(routing);',
      ].join('\n'),
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    expect(result.code).not.toContain("import './types'");
  });

  it('holds the wrapper when a side-effect import targets the torn-down library', () => {
    const result = transformNavigationFile(
      'src/i18n/navigation.ts',
      [
        "import 'next-intl/config';",
        "import { createNavigation } from 'next-intl/navigation';",
        "import { routing } from './routing';",
        'export const { Link } = createNavigation(routing);',
      ].join('\n'),
      makeContext()
    );
    expect(result.code).toBeNull();
    expect(
      result.skipReasons.some((reason) =>
        reason.includes("side-effect import of 'next-intl/config'")
      )
    ).toBe(true);
  });
});

describe('transformSourceFile: owned-module side-effect import retention', () => {
  it('does not silently delete a bare owned-module import during locale-type pruning', () => {
    const result = transformSourceFile(
      'src/app/page.tsx',
      [
        "import 'next-intl';",
        "import { Locale, useTranslations } from 'next-intl';",
        'export function Page({ locale }: { locale: Locale }) {',
        "  const t = useTranslations('Home');",
        "  return <p>{t('title')}{locale}</p>;",
        '}',
      ].join('\n'),
      makeContext(),
      {}
    );
    // The side-effect import must never vanish silently: the file is held
    // with an explicit reason, like a re-export.
    expect(
      result.skipReasons.some((reason) =>
        reason.includes("side-effect import of 'next-intl'")
      )
    ).toBe(true);
  });

  it('holds a file whose only owned surface is a side-effect import', () => {
    const result = transformSourceFile(
      'src/polyfills.ts',
      ["import 'next-intl';", 'export const x = 1;'].join('\n'),
      makeContext(),
      {}
    );
    expect(
      result.skipReasons.some((reason) =>
        reason.includes("side-effect import of 'next-intl'")
      )
    ).toBe(true);
  });
});

describe('react-intl: side-effect import retention', () => {
  it('keeps converting past a @formatjs polyfill side-effect import and retains it', () => {
    // Runtime polyfills survive teardown (they are not in teardownPackages),
    // so their imports stay valid: the file converts and the import stays.
    const ctx = makeContext(reactIntlAdapter);
    ctx.catalogs.byLocale.en = { title: 'Title' };
    const result = transformSourceFile(
      'src/app/page.tsx',
      [
        "import '@formatjs/intl-numberformat/polyfill';",
        "import { FormattedMessage } from 'react-intl';",
        'export function Page() {',
        '  return <FormattedMessage id="title" defaultMessage="Title" />;',
        '}',
      ].join('\n'),
      ctx,
      {}
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    expect(result.code).toContain(
      "import '@formatjs/intl-numberformat/polyfill'"
    );
    expect(result.code).not.toContain('react-intl');
  });

  it('holds a file with a bare react-intl side-effect import (torn down)', () => {
    const result = transformSourceFile(
      'src/app/page.tsx',
      [
        "import 'react-intl';",
        "import { FormattedMessage } from 'react-intl';",
        'export function Page() {',
        '  return <FormattedMessage id="title" defaultMessage="Title" />;',
        '}',
      ].join('\n'),
      makeContext(reactIntlAdapter),
      {}
    );
    expect(
      result.skipReasons.some((reason) =>
        reason.includes("side-effect import of 'react-intl'")
      )
    ).toBe(true);
  });
});

describe('react-i18next: side-effect import pass-through', () => {
  it('leaves a bare i18next side-effect import untouched', () => {
    const result = transformSourceFile(
      'src/setup.ts',
      ["import 'i18next';", 'export const x = 1;'].join('\n'),
      makeContext(reactI18nextAdapter),
      {}
    );
    // A bare i18next import is bespoke setup: the file is held with an
    // explicit reason, never silently rewritten.
    expect(
      result.skipReasons.some((reason) => reason.includes('bespoke setup'))
    ).toBe(true);
  });
});
