import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import { reactIntlAdapter } from '../adapters/reactIntl.js';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
  SourceAdapter,
} from '../pipeline/types.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(
  adapter: SourceAdapter,
  edits: MigrationContext['edits']
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
    edits,
    todos: [],
    skippedFiles: new Map([['/project/src/legacy.tsx', ['unsupported API']]]),
    stats: {},
    adapter,
  };
}

describe('buildReport retained-provider wording', () => {
  it('names the provider when a written edit actually renders it', () => {
    // A real retained-provider file: imports the provider from the library
    // and renders it. The detection is adapter.hasProvider (AST), so a bare
    // JSX snippet without the import does not count.
    const ctx = makeContext(nextIntlAdapter, [
      {
        path: '/project/src/app/[locale]/layout.tsx',
        kind: 'write',
        content: [
          "import { NextIntlClientProvider } from 'next-intl';",
          'export default function Layout({ locale, children }) {',
          '  return (',
          '    <GTProvider><NextIntlClientProvider locale={locale}>{children}</NextIntlClientProvider></GTProvider>',
          '  );',
          '}',
        ].join('\n'),
      },
    ]);
    const report = buildReport(ctx, false, false);
    expect(report).toContain(
      'NextIntlClientProvider still renders (nested inside GTProvider)'
    );
  });

  it('names files that keep the original catalog tree live (round-10 claims F3)', () => {
    // The migration serves catalogs from messages-gt/ while a surviving file
    // still imports messages/ (page metadata is the field case): two live
    // catalog trees, drifting silently unless the report says so.
    const ctx = makeContext(reactIntlAdapter, [
      {
        path: '/project/src/i18n/config.ts',
        kind: 'write',
        content:
          "import en from '../../messages/en.json';\nexport const metaMessages = { en };\n",
      },
    ]);
    ctx.catalogs.dir = '/project/messages-gt';
    ctx.catalogs.sourceDir = '/project/messages';
    ctx.projectFiles = ['/project/src/i18n/config.ts'];
    const report = buildReport(ctx, false, false);
    expect(report).toContain('two live catalog trees');
    expect(report).toContain('src/i18n/config.ts');
  });

  it('names them for the react-i18next per-namespace shape too (round-10 claims F3)', () => {
    // The other live shape, measured on react-i18next/plantpal: catalogs read
    // from locales/{lng}/{ns}.json, served from gt/dictionaries/, and the
    // survivors import the namespace files by relative path and by `@/` alias
    // (generateMetadata is the field case). `@/lib/locales` shares the prefix
    // word but is a helper module, so it must not be listed.
    const ctx = makeContext(reactI18nextAdapter, [
      {
        path: '/project/i18n.ts',
        kind: 'write',
        content: "import en from './locales/en/common.json';\n",
      },
      {
        path: '/project/app/[locale]/layout.tsx',
        kind: 'write',
        content: [
          "import { isAppLocale } from '@/lib/locales';",
          "import es from '@/locales/es/common.json';",
          'export async function generateMetadata() {',
          '  return { description: es.meta.description };',
          '}',
        ].join('\n'),
      },
      {
        path: '/project/lib/i18n-routing.ts',
        kind: 'write',
        content: "import { isAppLocale } from '@/lib/locales';\n",
      },
    ]);
    ctx.catalogs.dir = '/project/gt/dictionaries';
    ctx.catalogs.sourceDir = '/project/locales';
    ctx.projectFiles = [
      '/project/i18n.ts',
      '/project/app/[locale]/layout.tsx',
      '/project/lib/i18n-routing.ts',
    ];
    const report = buildReport(ctx, false, false);
    expect(report).toContain('two live catalog trees');
    // Scoped to the section's own bullet list: every path here is also listed
    // under Converted, so a whole-report toContain would pass on that alone.
    const listed = report.split('two live catalog trees')[1].split('\n\n')[0];
    expect(listed).toContain('- i18n.ts');
    expect(listed).toContain('- app/[locale]/layout.tsx');
    expect(listed).not.toContain('lib/i18n-routing.ts');
  });

  it('stays silent about catalog trees when the serving dir was not repointed (control)', () => {
    const ctx = makeContext(reactIntlAdapter, [
      {
        path: '/project/src/i18n/config.ts',
        kind: 'write',
        content: "import en from '../../messages/en.json';\n",
      },
    ]);
    ctx.projectFiles = ['/project/src/i18n/config.ts'];
    const report = buildReport(ctx, false, false);
    expect(report).not.toContain('two live catalog trees');
  });

  it('names package.json, the lockfile, and the report file as changed (round-10 claims F5)', () => {
    const report = buildReport(makeContext(nextIntlAdapter, []), false, false);
    expect(report).toContain('Also changed by this run: package.json');
    expect(report).toContain('lockfile');
    expect(report).toContain('gt-migrate-report.md');
  });

  it("states each library's own missing-key behavior (round-10 claims F4)", () => {
    // Measured per library: react-intl rendered the defaultMessage (misses
    // invisible), react-i18next rendered the raw key without logging; the old
    // generic 'rendered the raw key and logged' sentence was false for both.
    const rIntl = buildReport(makeContext(reactIntlAdapter, []), false, false);
    expect(rIntl).toContain('rendered the defaultMessage without logging');
    expect(rIntl).not.toContain('react-intl rendered the raw key');
    const rI18n = buildReport(
      makeContext(reactI18nextAdapter, []),
      false,
      false
    );
    expect(rI18n).toContain('rendered the raw key without logging');
  });

  it('does not claim retention for a lookalike component name (round-10 claims F1)', () => {
    // `<IntlProviderWrapper` contains `<IntlProvider` as a substring; the
    // substring form claimed a retained provider over a fully torn-down tree
    // and prescribed a re-run the CLI refuses once the library is removed.
    const ctx = makeContext(reactIntlAdapter, [
      {
        path: '/project/src/app/[locale]/layout.tsx',
        kind: 'write',
        content: [
          "import { IntlProviderWrapper } from '../../i18n/intl-provider';",
          'export default function Layout({ locale, messages, children }) {',
          '  return (',
          '    <IntlProviderWrapper locale={locale} messages={messages}>{children}</IntlProviderWrapper>',
          '  );',
          '}',
        ].join('\n'),
      },
    ]);
    const report = buildReport(ctx, false, false);
    expect(report).not.toContain('still renders');
  });

  it('claims only the retained package when no written edit renders a provider', () => {
    // A bespoke server-side setup never rendered a provider; the report must
    // not invent one.
    const ctx = makeContext(reactI18nextAdapter, [
      {
        path: '/project/src/app/[locale]/layout.tsx',
        kind: 'write',
        content: '<GTProvider>{children}</GTProvider>',
      },
    ]);
    const report = buildReport(ctx, false, false);
    expect(report).not.toContain('still renders');
    expect(report).toContain(
      'react-i18next is still installed so these keep working'
    );
  });
});
