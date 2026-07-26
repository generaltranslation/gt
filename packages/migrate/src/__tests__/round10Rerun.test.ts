import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeCapturedIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Round 10, N2: a re-run listed gt.config.json and gt/dictionaries/*.json under
// "Converted" while `git status` showed only the report had changed. The engine
// already dropped byte-identical SOURCE writes; the emitted files now go through
// the same rule. Drives the real pipeline twice over a real tmpdir project.
// ---------------------------------------------------------------------------

registerTreeCleanup();

const lines = (...parts: string[]) => parts.join('\n') + '\n';

/**
 * A react-i18next app whose second file escapes its `t` as a value, so the
 * migration is partial: react-i18next stays installed and a re-run has
 * something to do instead of refusing outright.
 */
const app: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'rerun-demo',
      dependencies: {
        next: '15.5.0',
        react: '19.0.0',
        i18next: '^23.11.0',
        'react-i18next': '^14.1.0',
      },
    },
    null,
    2
  ),
  'locales/en/translation.json': JSON.stringify({ title: 'Welcome' }, null, 2),
  'locales/es/translation.json': JSON.stringify(
    { title: 'Bienvenido' },
    null,
    2
  ),
  'next.config.js': lines('module.exports = {};'),
  'app/[locale]/layout.tsx': lines(
    'export default function LocaleLayout({',
    '  children,',
    '}: {',
    '  children: React.ReactNode;',
    '}) {',
    '  return <html><body>{children}</body></html>;',
    '}'
  ),
  'app/[locale]/page.tsx': lines(
    "'use client';",
    "import { useTranslation } from 'react-i18next';",
    'export default function Page() {',
    '  const { t } = useTranslation();',
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
  'app/[locale]/held.tsx': lines(
    "'use client';",
    "import { useTranslation } from 'react-i18next';",
    'export function Held() {',
    '  const { t } = useTranslation();',
    '  const label = (key: string) => t(key);',
    '  return <p>{label("title")}</p>;',
    '}'
  ),
};

async function migrate(cwd: string): Promise<MigrationContext> {
  const io = makeCapturedIO();
  return runMigration(
    {
      config: 'gt.config.json',
      from: 'react-i18next',
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    'react-i18next',
    io.io,
    cwd
  );
}

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

/** Writes this run planned whose bytes already match the file on disk. */
function noOpWrites(ctx: MigrationContext, cwd: string): string[] {
  return ctx.edits
    .filter((edit) => {
      if (edit.kind !== 'write') return false;
      let current: string;
      try {
        current = fs.readFileSync(edit.path, 'utf8');
      } catch {
        return false;
      }
      return current === (edit.content ?? '');
    })
    .map((edit) => path.relative(cwd, edit.path));
}

function section(report: string, heading: string): string {
  return report.split(`## ${heading}`)[1]?.split('\n## ')[0] ?? '';
}

describe('round 10 N2: a re-run does not list writes it did not change', () => {
  it('re-emits no byte-identical catalog write and reports none', async () => {
    const cwd = makeTree(app, { prefix: 'gt-migrate-r10-rerun-' });

    const first = await migrate(cwd);
    applyEdits(first.edits);
    // The premise: run 1 really did emit these, so run 2 has something to drop.
    const emitted = first.edits.map((edit) => path.relative(cwd, edit.path));
    expect(emitted).toContain('gt.config.json');
    expect(emitted).toContain(path.join('gt', 'dictionaries', 'en.json'));

    const second = await migrate(cwd);

    // Nothing the second run plans is a write of bytes already on disk.
    expect(noOpWrites(second, cwd)).toEqual([]);
    const rewritten = second.edits
      .filter((edit) => edit.kind === 'write')
      .map((edit) => path.relative(cwd, edit.path));
    expect(rewritten).not.toContain('gt.config.json');
    expect(rewritten).not.toContain(path.join('gt', 'dictionaries', 'en.json'));
    expect(rewritten).not.toContain(path.join('gt', 'dictionaries', 'es.json'));

    // ...and the report cannot list them either, since it reads the same edits.
    // Matched as bullets: both sections carry prose that names the catalog
    // directory legitimately ("catalogs in gt/dictionaries/ now load through
    // loadDictionary.ts"), and that sentence is true on a re-run.
    const report = buildReport(second, false, false);
    for (const heading of ['Converted', 'Created (new files this run added)']) {
      const body = section(report, heading);
      expect(body).not.toContain('- gt.config.json');
      expect(body).not.toContain('- gt/dictionaries/en.json');
      expect(body).not.toContain('- gt/dictionaries/es.json');
    }
    expect(section(report, 'Converted')).toContain('(no files changed)');
  });

  it('still emits the catalogs on the first run (control)', async () => {
    const cwd = makeTree(app, { prefix: 'gt-migrate-r10-rerun-first-' });
    const first = await migrate(cwd);
    const report = buildReport(first, false, false);

    expect(noOpWrites(first, cwd)).toEqual([]);
    expect(report).toContain('gt/dictionaries/en.json');
    expect(report).toContain('gt.config.json');
  });
});
