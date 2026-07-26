import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';

// Make the source transform throw for one file (simulating a babel replaceWith
// throw), and behave normally for everything else. Both the driver and the
// layout pass import transformSourceFile from this module, so the wrapper
// covers both; only files named boom.tsx blow up.
vi.mock('../transforms/transformSource.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../transforms/transformSource.js')>();
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

// runMigration is UI-free: the shared fake io is enough for a non-interactive,
// --allow-dirty, --yes run (guardGit and the confirm prompt are no-ops here).
registerTreeCleanup();

function makeApp(): string {
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
  return makeTree(files, { prefix: 'gt-migrate-hard-' });
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

  it('refuses loudly without -y in a non-interactive session (round-10 claims F6)', async () => {
    // The prompt library's cancel path exits 0 with nothing written, which a
    // CI job reads as a successful no-op migration. The engine must refuse
    // with a real error before ever prompting.
    const cwd = makeTree(
      {
        'package.json': JSON.stringify({
          name: 'demo',
          dependencies: { next: '15.5.0', 'next-intl': '^4.1.0' },
        }),
      },
      { prefix: 'gt-migrate-noninter-' }
    );
    fs.mkdirSync(path.join(cwd, 'src/app'), { recursive: true });
    const originalTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      configurable: true,
    });
    const io = makeIO();
    try {
      await expect(
        runMigration(
          {
            config: 'gt.config.json',
            from: 'next-intl',
            dryRun: false,
            yes: false,
            allowDirty: true,
          },
          'next-intl',
          io,
          cwd
        )
      ).rejects.toThrow(/not interactive/);
    } finally {
      if (originalTTY) {
        Object.defineProperty(process.stdin, 'isTTY', originalTTY);
      }
    }
    expect(io.promptConfirm).not.toHaveBeenCalled();
  });
});
