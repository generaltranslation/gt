import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Round 10, greptile: the requestLocale rewiring had no idempotency guard. Run 1
// rewires the fallback through gt-next's getLocale(); run 2 no longer matches
// the `{ requestLocale }` shape it is looking for, reads that as "shape not
// recognized", and tells the user to wire a fallback the first run already
// wired. Nothing is written wrong, but the instruction is false. Drives the
// real pipeline twice over a real tmpdir project, the way round10Rerun does.
// ---------------------------------------------------------------------------

registerTreeCleanup();

const lines = (...parts: string[]) => parts.join('\n') + '\n';

/**
 * A next-intl app whose stats component imports an unsupported API, so the
 * migration stays partial: next-intl is retained, src/i18n/request.ts survives
 * teardown, and the requestLocale lane (which only runs when skips remain) is
 * live on both runs.
 */
const app: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'request-config-rerun',
      dependencies: {
        next: '15.5.0',
        'next-intl': '^4.1.0',
        react: '19.0.0',
      },
    },
    null,
    2
  ),
  'next.config.ts': lines(
    "import createNextIntlPlugin from 'next-intl/plugin';",
    'const withNextIntl = createNextIntlPlugin();',
    'export default withNextIntl({});'
  ),
  'src/i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    "  localePrefix: 'always',",
    '});'
  ),
  'src/i18n/request.ts': lines(
    "import { getRequestConfig } from 'next-intl/server';",
    "import { hasLocale } from 'next-intl';",
    "import { routing } from './routing';",
    '',
    'export default getRequestConfig(async ({ requestLocale }) => {',
    '  const requested = await requestLocale;',
    '  const locale = hasLocale(routing.locales, requested)',
    '    ? requested',
    '    : routing.defaultLocale;',
    '  return {',
    '    locale,',
    '    messages: (await import(`../../messages/${locale}.json`)).default,',
    '  };',
    '});'
  ),
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }, null, 2),
  'messages/es.json': JSON.stringify(
    { Home: { title: 'Bienvenido' } },
    null,
    2
  ),
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
  'src/app/[locale]/page.tsx': lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Home() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
  // Unsupported API: this file is skipped, which is what keeps next-intl (and
  // its request config) alive across both runs.
  'src/app/[locale]/stats.tsx': lines(
    "'use client';",
    "import { useFormatter } from 'next-intl';",
    'export function Stats({ value }: { value: number }) {',
    '  const format = useFormatter();',
    '  return <p>{format.number(value)}</p>;',
    '}'
  ),
};

const migrate = (cwd: string): Promise<MigrationContext> =>
  runMigration(
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

function applyEdits(edits: FileEdit[]): void {
  for (const edit of edits) {
    if (edit.kind === 'delete') {
      fs.rmSync(edit.path, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(edit.path), { recursive: true });
    fs.writeFileSync(edit.path, edit.content ?? '');
  }
}

const REQUEST_FILE = path.join('src', 'i18n', 'request.ts');

/** The TODOs this run raised against the request config, by reason. */
const requestConfigTodos = (ctx: MigrationContext, cwd: string): string[] =>
  ctx.todos
    .filter((todo) => path.relative(cwd, todo.file) === REQUEST_FILE)
    .map((todo) => todo.reason);

/** Writes this run planned for the request config. */
const requestConfigWrites = (ctx: MigrationContext, cwd: string): FileEdit[] =>
  ctx.edits.filter(
    (edit) =>
      edit.kind === 'write' && path.relative(cwd, edit.path) === REQUEST_FILE
  );

describe('round 10 greptile: the requestLocale rewiring is idempotent', () => {
  it('run 1 wires the fallback and raises no request-config TODO (control)', async () => {
    const cwd = makeTree(app, { prefix: 'gt-migrate-r10-reqcfg-first-' });

    const first = await migrate(cwd);

    // The premise of the whole test: the migration really is partial, so the
    // requestLocale lane runs at all.
    expect(first.skippedFiles.size).toBeGreaterThan(0);
    const written = requestConfigWrites(first, cwd);
    expect(written).toHaveLength(1);
    const code = written[0].content!;
    expect(code).toContain('requestLocale: _gtRequestLocale');
    expect(code).toContain('_gtRequestLocale.then');
    expect(code).toMatch(/import \{ getLocale \} from ["']gt-next\/server["']/);
    expect(requestConfigTodos(first, cwd)).toEqual([]);
  });

  it('run 2 neither rewrites the request config nor repeats the TODO', async () => {
    const cwd = makeTree(app, { prefix: 'gt-migrate-r10-reqcfg-' });

    const first = await migrate(cwd);
    applyEdits(first.edits);
    // Run 1 left the file wired and on disk (teardown keeps it while skips remain).
    const onDisk = fs.readFileSync(path.join(cwd, REQUEST_FILE), 'utf8');
    expect(onDisk).toContain('_gtRequestLocale.then');

    const second = await migrate(cwd);

    // Still partial, so the lane is live on run 2 too; the guard is what stops
    // it, not an early exit somewhere upstream.
    expect(second.skippedFiles.size).toBeGreaterThan(0);
    // OBSERVED on 8c9a14769: one TODO reading "request config shape not
    // recognized; ... wire the fallback to gt-next/server getLocale()", against
    // a file whose fallback is already wired to exactly that.
    expect(requestConfigTodos(second, cwd)).toEqual([]);
    expect(requestConfigWrites(second, cwd)).toEqual([]);

    const report = buildReport(second, false, false);
    expect(report).not.toContain('request config shape not recognized');
  });
});
