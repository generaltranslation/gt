// Pinned reproductions from the round-10 architecture review (finding A2).
// Written red against b27d1c0ff, green with the fix; they run the real
// pipeline over a tmpdir project because the defect lived in the seam
// between two passes, exactly where hand-built-context unit tests cannot see.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MigrationContext } from '../pipeline/types.js';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length)
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function makeIO(localeList: string[] = []): MigrateIO {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn((message: string) => {
      throw new Error(message);
    }) as unknown as (message: string) => never,
    guardGit: vi.fn(),
    promptConfirm: vi.fn(async () => true),
    promptText: vi.fn(async () => 'messages'),
    promptLocale: vi.fn(async () => 'en'),
    promptLocaleList: vi.fn(async () => localeList),
  };
}

const lines = (...parts: string[]) => parts.join('\n') + '\n';

function tree(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-test-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

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
  // The ONLY remaining importer of the routing config. Not an i18n file, so it
  // is never skipped and never rewritten; the teardown guard is all that stands
  // between it and a dangling import.
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
    const ctx = await migrate(cwd, makeIO());
    expect(deletedRouting(ctx, cwd)).toBe(false); // PASSES
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
    const ctx = await migrate(cwd, makeIO());
    // OBSERVED on b27d1c0ff: deleted === true, 0 skips, 0 todos, 0 warnings.
    // The surviving src/lib/localeList.ts now imports a file that is gone.
    expect(deletedRouting(ctx, cwd)).toBe(false); // FAILS
  });
});
