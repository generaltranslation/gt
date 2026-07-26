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
