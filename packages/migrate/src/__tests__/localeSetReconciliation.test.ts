// Pinned reproductions from the round-10 architecture review (finding A1).
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

const write = (ctx: MigrationContext, tail: string) =>
  ctx.edits.find((e) => e.kind === 'write' && e.path.endsWith(tail));

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

const A1_FILES: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  // routing declares THREE locales...
  'src/i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es', 'fr'],",
    "  defaultLocale: 'en',",
    "  localePrefix: 'always',",
    '});'
  ),
  'src/i18n/request.ts': lines(
    "import { getRequestConfig } from 'next-intl/server';",
    "import { routing } from './routing';",
    'export default getRequestConfig(async ({ requestLocale }) => {',
    '  const requested = await requestLocale;',
    '  const locale = routing.locales.includes(requested as never)',
    '    ? requested',
    '    : routing.defaultLocale;',
    '  return {',
    '    locale,',
    '    messages: (await import(`../../messages/${locale}.json`)).default,',
    '  };',
    '});'
  ),
  'next.config.ts': nextConfig,
  // ...but only TWO have catalogs on disk, so discoverCatalogs bails and the
  // interactive fallback (runMigration.ts:220-230) takes over.
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
  'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
  'src/app/[locale]/layout.tsx': lines(
    "import { NextIntlClientProvider } from 'next-intl';",
    "import { getMessages, setRequestLocale } from 'next-intl/server';",
    "import { routing } from '../../i18n/routing';",
    'export function generateStaticParams() {',
    '  return routing.locales.map((locale) => ({ locale }));',
    '}',
    'export default async function LocaleLayout({ children, params }: {',
    '  children: React.ReactNode;',
    '  params: Promise<{ locale: string }>;',
    '}) {',
    '  const { locale } = await params;',
    '  setRequestLocale(locale);',
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
};

describe('A1: which locale set applies?', () => {
  it('the prerendered locale set and the gt.config locale set must agree', async () => {
    const cwd = tree(A1_FILES);
    const originalTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    });
    let ctx: MigrationContext;
    try {
      // The user answers "migrate en and es" (fr has no catalog file).
      ctx = await migrate(cwd, makeIO(['en', 'es']));
    } finally {
      if (originalTTY)
        Object.defineProperty(process.stdin, 'isTTY', originalTTY);
    }

    const layout = write(ctx, 'layout.tsx')!.content!;
    const gtConfig = JSON.parse(write(ctx, 'gt.config.json')!.content!);

    // OBSERVED on b27d1c0ff:
    //   layout    -> return ["en", "es", "fr"].map((locale) => ({ locale }));
    //   gt.config -> "locales": ["en", "es"]
    //   src/i18n/routing.ts DELETED, 0 skips, 0 todos, 0 warnings,
    //   and the report never mentions "fr".
    expect(layout).not.toContain('"fr"');
    expect(gtConfig.locales).toEqual(ctx.routing.locales);
    // Nothing tells the user either way:
    expect(ctx.warnings ?? []).not.toHaveLength(0);
  });
});
