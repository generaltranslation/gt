import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import type * as t from '@babel/types';
import { removeUnusedNamedImports } from '../transforms/importUtils.js';
import { transformLayoutFile } from '../transforms/transformLayout.js';
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
  const layoutWithGlobals = [
    "import './globals.css';",
    "import { NextIntlClientProvider } from 'next-intl';",
    "import { getMessages, setRequestLocale } from 'next-intl/server';",
    'export default async function LocaleLayout({',
    '  children,',
    '  params,',
    '}: {',
    '  children: React.ReactNode;',
    '  params: Promise<{ locale: string }>;',
    '}) {',
    '  const { locale } = await params;',
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

  it('keeps import "./globals.css" when the layout is mutated', () => {
    const result = transformLayoutFile(
      'src/app/[locale]/layout.tsx',
      layoutWithGlobals,
      makeContext()
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).not.toBeNull();
    // the transform really ran (provider swapped), so the cleanup pass executed
    expect(result.code).toContain('<GTProvider>');
    // the pre-existing stylesheet import must survive the cleanup pass
    expect(result.code).toContain("import './globals.css'");
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
  it('holds a file with a @formatjs polyfill side-effect import', () => {
    const result = transformSourceFile(
      'src/app/page.tsx',
      [
        "import '@formatjs/intl-numberformat/polyfill';",
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
        reason.includes(
          "side-effect import of '@formatjs/intl-numberformat/polyfill'"
        )
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
