import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
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
    const ctx = makeContext(nextIntlAdapter, [
      {
        path: '/project/src/app/[locale]/layout.tsx',
        kind: 'write',
        content:
          '<GTProvider><NextIntlClientProvider locale={locale}>{children}</NextIntlClientProvider></GTProvider>',
      },
    ]);
    const report = buildReport(ctx, false, false);
    expect(report).toContain(
      'NextIntlClientProvider still renders (nested inside GTProvider)'
    );
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
