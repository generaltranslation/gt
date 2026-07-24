import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { buildReport } from '../report/report.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MigrationContext } from '../pipeline/types.js';

// Round-9 harness audit (2026-07-24): the emitted report went silent about
// files that still reference the source library after the run. Two shapes
// shipped in every migrated next-intl fixture: i18n/request.ts listed under
// "Converted" while still importing next-intl, and i18n/routing.ts retained
// (still imported by kept wiring) but named nowhere in the report. The report
// builder now (a) annotates Converted entries that still reference the
// library and (b) sweeps every project file's post-run content and names the
// unnamed under "Still referencing <library>".
//
// Every test drives the REAL pipeline against a real tmpdir project; nothing
// hand-populates a MigrationContext.

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

function writeTree(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-r9-report-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

function migrate(cwd: string): Promise<MigrationContext> {
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

const lines = (...l: string[]) => l.join('\n');

/** Post-run content of a file: the pending edit when written, disk otherwise. */
function postRunContent(ctx: MigrationContext, abs: string): string | null {
  const edit = [...ctx.edits]
    .reverse()
    .find((candidate) => candidate.path === abs);
  if (edit?.kind === 'delete') return null;
  if (edit?.kind === 'write') return edit.content ?? '';
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

const baseApp = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
  'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
  'i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    '});'
  ),
  'i18n/request.ts': lines(
    "import { getRequestConfig } from 'next-intl/server';",
    "import { hasLocale } from 'next-intl';",
    "import { routing } from './routing';",
    'export default getRequestConfig(async ({ requestLocale }) => {',
    '  const requested = await requestLocale;',
    '  const locale = hasLocale(routing.locales, requested)',
    '    ? requested',
    '    : routing.defaultLocale;',
    '  return {',
    '    locale,',
    '    messages: (await import(`../messages/${locale}.json`)).default,',
    '  };',
    '});'
  ),
  'next.config.ts': lines(
    "import createNextIntlPlugin from 'next-intl/plugin';",
    'const withNextIntl = createNextIntlPlugin();',
    'export default withNextIntl({});'
  ),
  'app/[locale]/layout.tsx': lines(
    "import { NextIntlClientProvider } from 'next-intl';",
    "import { setRequestLocale } from 'next-intl/server';",
    'export default async function LocaleLayout({',
    '  children,',
    '  params,',
    '}: {',
    '  children: React.ReactNode;',
    '  params: Promise<{ locale: string }>;',
    '}) {',
    '  const { locale } = await params;',
    '  setRequestLocale(locale);',
    '  return (',
    '    <html lang={locale}>',
    '      <body>',
    '        <NextIntlClientProvider>{children}</NextIntlClientProvider>',
    '      </body>',
    '    </html>',
    '  );',
    '}'
  ),
  'app/[locale]/page.tsx': lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Page() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
};

// t.rich always skips its file, which retains next-intl and keeps the run in
// partial mode: the shape where retained wiring goes silent in the report.
const richPage = lines(
  "import { useTranslations } from 'next-intl';",
  'export default function Rich() {',
  "  const t = useTranslations('Home');",
  "  return <p>{t.rich('title', { b: (chunk) => <b>{chunk}</b> })}</p>;",
  '}'
);

describe('round 9: the report names every post-run source-library reference', () => {
  it('partial mode: every file still referencing next-intl appears in the report', async () => {
    const cwd = writeTree({
      ...baseApp,
      'app/[locale]/rich/page.tsx': richPage,
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false);

    // The generic invariant (harness assertion R4, mechanized here): every
    // project file whose post-run content still references next-intl is
    // named somewhere in the report.
    const unnamed: string[] = [];
    for (const abs of ctx.projectFiles ?? []) {
      const content = postRunContent(ctx, abs);
      if (content === null) continue;
      if (!ctx.adapter.mentionedIn(content)) continue;
      const rel = path.relative(cwd, abs).split(path.sep).join('/');
      const relNative = path.relative(cwd, abs);
      if (!report.includes(rel) && !report.includes(relNative)) {
        unnamed.push(rel);
      }
    }
    expect(unnamed).toEqual([]);

    // The concrete round-9 instance: the retained routing module is named.
    expect(report).toContain('i18n/routing.ts');
  });

  it('annotates a Converted entry that still references next-intl', async () => {
    const cwd = writeTree({
      ...baseApp,
      'app/[locale]/rich/page.tsx': richPage,
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false);

    // In partial mode at least one written file keeps a next-intl reference
    // (the composed next.config, or the request config). Its Converted line
    // must not read as fully converted.
    const rewrittenStillReferencing = ctx.edits.filter(
      (edit) =>
        edit.kind === 'write' &&
        /\.[cm]?[jt]sx?$/.test(edit.path) &&
        ctx.adapter.mentionedIn(edit.content ?? '')
    );
    expect(rewrittenStillReferencing.length).toBeGreaterThan(0);
    for (const edit of rewrittenStillReferencing) {
      const rel = path.relative(cwd, edit.path).split(path.sep).join('/');
      const relNative = path.relative(cwd, edit.path);
      const annotated = new RegExp(
        `- (${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${relNative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}) \\(rewritten; still references next-intl`
      );
      expect(report).toMatch(annotated);
    }
  });

  it('full migration: no Still referencing section and no annotations', async () => {
    const {
      'i18n/routing.ts': _routing,
      'i18n/request.ts': _request,
      ...rest
    } = baseApp;
    const cwd = writeTree({
      ...rest,
      // No routing/request infrastructure and no rich page: the run converts
      // everything and tears next-intl down completely.
      'i18n/routing.ts': _routing,
      'i18n/request.ts': _request,
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false);
    expect(report).not.toContain('## Still referencing');
    expect(report).not.toContain('(rewritten; still references');
  });
});
