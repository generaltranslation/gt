import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMigrateCommand } from '../../cli/commands/migrate.js';

vi.mock('../../hooks/postProcess.js', () => ({
  formatFiles: vi.fn(async () => {}),
  detectFormatter: vi.fn(async () => null),
}));

vi.mock('../../utils/installPackage.js', () => ({
  installPackage: vi.fn(async () => {}),
}));

vi.mock('../../utils/packageManager.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPackageManager: vi.fn(async () => ({
    id: 'npm',
    name: 'npm',
    label: 'npm',
    installCommand: 'install',
    devDependencyFlag: '--save-dev',
  })),
}));

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

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const read = (cwd: string, rel: string) =>
  fs.readFileSync(path.join(cwd, rel), 'utf8');

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

describe('handleMigrateCommand transform hardening', () => {
  it('degrades a throwing file to a reported skip and finishes the run', async () => {
    const cwd = makeApp();
    // The run must complete rather than aborting with a raw stack trace.
    await handleMigrateCommand(
      {
        config: 'gt.config.json',
        from: 'next-intl',
        dryRun: false,
        yes: true,
        allowDirty: true,
      },
      'next-intl',
      cwd
    );

    // The throwing file is left completely untouched.
    expect(read(cwd, 'src/components/boom.tsx')).toContain('next-intl');
    expect(read(cwd, 'src/components/boom.tsx')).not.toContain('gt-next');

    // The report carries the internal-error skip for that file.
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('internal transform error');
    expect(report).toContain('boom.tsx');

    // The rest of the run still happened: the good page migrated to gt-next.
    expect(read(cwd, 'src/app/[locale]/page.tsx')).toMatch(
      /from ["']gt-next["']/
    );

    // A skip means partial mode: next-intl stays installed (teardown blocked).
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['next-intl']).toBeDefined();
  });
});
