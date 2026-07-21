import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../report.js';
import { runMigration } from '../runMigration.js';
import type { MigrateIO } from '../io.js';

// Make the source transform throw for one file (simulating a babel replaceWith
// throw), and behave normally for everything else. Both the driver and the
// layout pass import transformSourceFile from this module, so the wrapper
// covers both; only files named boom.tsx blow up.
vi.mock('../transformSource.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../transformSource.js')>();
  return {
    ...actual,
    transformSourceFile: (
      file: string,
      code: string,
      ctx: Parameters<typeof actual.transformSourceFile>[2],
      options?: Parameters<typeof actual.transformSourceFile>[3]
    ) => {
      if (file.endsWith('boom.tsx')) {
        throw new Error('babel replaceWith blew up on boom.tsx');
      }
      return actual.transformSourceFile(file, code, ctx, options);
    },
  };
});

// runMigration is UI-free: this fake io is enough for a non-interactive,
// --allow-dirty, --yes run (guardGit and the confirm prompt are no-ops here).
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

function makeApp(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-hard-'));
  tmpDirs.push(cwd);
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'demo',
      dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
    }),
    'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
    'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
    'src/app/[locale]/page.tsx': [
      "import { useTranslations } from 'next-intl';",
      'export default function Home() {',
      "  const t = useTranslations('Home');",
      "  return <h1>{t('title')}</h1>;",
      '}',
    ].join('\n'),
    // The file whose transform throws.
    'src/components/boom.tsx': [
      "import { useTranslations } from 'next-intl';",
      'export function Boom() {',
      "  const t = useTranslations('Home');",
      "  return <span>{t('title')}</span>;",
      '}',
    ].join('\n'),
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

describe('runMigration transform hardening', () => {
  it('degrades a throwing file to a reported skip and finishes the run', async () => {
    const cwd = makeApp();
    // The run must complete (return a context) rather than throwing a raw
    // stack trace out of the engine.
    const ctx = await runMigration(
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

    // The throwing file is a reported skip, and no edit rewrites it.
    const boom = path.join(cwd, 'src/components/boom.tsx');
    const boomReasons = ctx.skippedFiles.get(boom);
    expect(boomReasons?.join(' ')).toMatch(/internal transform error/);
    expect(ctx.edits.some((edit) => edit.path === boom)).toBe(false);

    // The report carries the internal-error skip for that file.
    const report = buildReport(ctx, false, false);
    expect(report).toContain('internal transform error');
    expect(report).toContain('boom.tsx');

    // The rest of the run still happened: the good page has a gt-next edit.
    const pageEdit = ctx.edits.find((edit) =>
      edit.path.endsWith(path.join('[locale]', 'page.tsx'))
    );
    expect(pageEdit?.content).toMatch(/from ["']gt-next["']/);

    // A skip means partial mode: teardown is blocked, so any package.json edit
    // keeps next-intl (and typically there is none).
    const pkgEdit = ctx.edits.find((edit) =>
      edit.path.endsWith('package.json')
    );
    if (pkgEdit) expect(pkgEdit.content).toContain('next-intl');
  });
});
