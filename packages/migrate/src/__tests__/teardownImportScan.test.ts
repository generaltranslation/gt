// Pinned reproductions from the round-10 architecture review (finding A2).
// Driven over a real tmpdir project, because the defect lived in the seam
// between two passes where a hand-built context cannot reach.

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MigrationContext } from '../pipeline/types.js';

registerTreeCleanup();

/** The interactive answers this suite scripts: catalogs in messages/, default en. */
const scriptedIO = (localeList: string[] = []) =>
  makeIO({ text: 'messages', locale: 'en', localeList });

const lines = (...parts: string[]) => parts.join('\n') + '\n';

const tree = (files: Record<string, string>) =>
  makeTree(files, { prefix: 'gt-migrate-test-' });

const migrate = (cwd: string, io: MigrateIO) =>
  runMigration(
    {
      config: 'gt.config.json',
      from: 'next-intl',
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    'next-intl',
    io,
    cwd
  );

const nextConfig = lines(
  "import createNextIntlPlugin from 'next-intl/plugin';",
  'const withNextIntl = createNextIntlPlugin();',
  'export default withNextIntl({});'
);

const page = lines(
  "import { useTranslations } from 'next-intl';",
  'export default function Home() {',
  "  const t = useTranslations('Home');",
  "  return <h1>{t('title')}</h1>;",
  '}'
);

const a2Files = (consumer: string): Record<string, string> => ({
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'src/i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    "  localePrefix: 'always',",
    '});'
  ),
  'next.config.ts': nextConfig,
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
  'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
  'src/app/[locale]/layout.tsx': lines(
    "import { NextIntlClientProvider } from 'next-intl';",
    "import { getMessages } from 'next-intl/server';",
    'export default async function LocaleLayout({ children, params }: {',
    '  children: React.ReactNode;',
    '  params: Promise<{ locale: string }>;',
    '}) {',
    '  const { locale } = await params;',
    '  const messages = await getMessages();',
    '  return (',
    '    <html lang={locale}>',
    '      <body>',
    '        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>',
    '      </body>',
    '    </html>',
    '  );',
    '}'
  ),
  'src/app/[locale]/page.tsx': page,
  // The last remaining importer of the routing config. Not an i18n file, so
  // the teardown guard is all that stands between it and a dangling import.
  'src/lib/localeList.ts': consumer,
});

const deletedRouting = (ctx: MigrationContext, cwd: string) =>
  ctx.edits.some(
    (e) =>
      e.kind === 'delete' && e.path === path.join(cwd, 'src/i18n/routing.ts')
  );

describe('A2: may this file be deleted?', () => {
  it('control: a normally-spaced importer retains the routing config', async () => {
    const cwd = tree(
      a2Files(
        lines(
          "import { routing } from '../i18n/routing';",
          'export const all = routing.locales;'
        )
      )
    );
    const ctx = await migrate(cwd, scriptedIO());
    expect(deletedRouting(ctx, cwd)).toBe(false); // green at b27d1c0ff
  });

  it("an importer written `from'x'` must also retain it", async () => {
    const cwd = tree(
      a2Files(
        lines(
          // one whitespace character removed, valid ES either way
          "import { routing } from'../i18n/routing';",
          'export const all = routing.locales;'
        )
      )
    );
    const ctx = await migrate(cwd, scriptedIO());
    // Observed on b27d1c0ff: deleted silently, leaving src/lib/localeList.ts
    // importing a file that is gone.
    expect(deletedRouting(ctx, cwd)).toBe(false); // red at b27d1c0ff
  });
});
