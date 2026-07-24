import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Round 9, panel round 2 (engine-safety lane). Each test pins one panel
// finding, reproduced first against the built engine and then fixed:
//
//  F1  a 'use client' index BARREL never reached the hazard scan: the cheap
//      prefilter keyed on the client module's basename ('index'), which the
//      importing route never writes, so the hazard was acquitted unparsed.
//  F2  per-route containment trusted a reaching-route set built from RESOLVED
//      edges only, so a second route reaching the same hazard through an
//      unresolvable specifier kept static rendering with the hazard in its
//      graph (a regression against the project-wide withhold it replaced).
//  F3  TEST_FILE_PATH was matched against the ABSOLUTE path, so a project
//      checked out under a directory named tests/ or e2e/ had every one of its
//      files reclassified as a test file (nothing converted, teardown held).
//  F7  a setup file the path pattern did not name (src/setupTests.ts, holding
//      the only jest.mock of the library) was filed as inert "retained wiring".
//  F9  the teardown's delete decision had the same acquittal-on-an-incomplete-
//      graph shape as F2, and it DELETES: a tsconfig `paths` alias that does
//      not mirror its target's path made the importer invisible.
//  F10 one unguarded readFileSync in the emit phase aborted the whole run on
//      an unreadable project file.
//  R1 #1 converted call sites whose keys are missing from the catalog turn
//      next-intl's soft fallback (render the key, log) into a gt-next throw.
//  R1 #2 re-running gt migrate (the remediation the report prescribes)
//      appended another withGTConfig(...) wrapper every run.
//
// Every test drives the REAL pipeline over files in a tmpdir: each of these
// shipped through a unit-level check that a hand-built context would pass.
// ---------------------------------------------------------------------------

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

const lines = (...parts: string[]) => parts.join('\n') + '\n';

const localeLayout = lines(
  "import { NextIntlClientProvider } from 'next-intl';",
  "import { getMessages, setRequestLocale } from 'next-intl/server';",
  'export function generateStaticParams() {',
  "  return [{ locale: 'en' }, { locale: 'es' }];",
  '}',
  'export default async function LocaleLayout({',
  '  children,',
  '  params,',
  '}: {',
  '  children: React.ReactNode;',
  '  params: Promise<{ locale: string }>;',
  '}) {',
  '  const { locale } = await params;',
  '  setRequestLocale(locale);',
  '  const messages = await getMessages();',
  '  return (',
  '    <html lang={locale}>',
  '      <body>',
  '        <NextIntlClientProvider messages={messages}>',
  '          {children}',
  '        </NextIntlClientProvider>',
  '      </body>',
  '    </html>',
  '  );',
  '}'
);

/** The 'use client' module whose exported hook must never run on the server. */
const clientWidget = lines(
  "'use client';",
  "import { useTranslations } from 'next-intl';",
  'export function useWidgetTitle() {',
  "  const t = useTranslations('Home');",
  "  return t('title');",
  '}'
);

const serverPage = (specifier: string) =>
  lines(
    `import { useWidgetTitle } from '${specifier}';`,
    'export default function About() {',
    '  const title = useWidgetTitle();',
    '  return <h1>{title}</h1>;',
    '}'
  );

const baseFiles: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
  'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
  'src/app/[locale]/layout.tsx': localeLayout,
  'src/app/[locale]/page.tsx': lines(
    'export default function Home() {',
    '  return <main>home</main>;',
    '}'
  ),
};

function writeFiles(cwd: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(cwd, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
}

/** A project in a fresh tmpdir. `root` puts it under a chosen parent (F3). */
function makeApp(
  overrides: Record<string, string> = {},
  options: { root?: string; prefix?: string } = {}
): string {
  const root = options.root ?? os.tmpdir();
  fs.mkdirSync(root, { recursive: true });
  const cwd = fs.mkdtempSync(
    path.join(root, options.prefix ?? 'gt-migrate-r9pe-')
  );
  tmpDirs.push(cwd);
  writeFiles(cwd, { ...baseFiles, ...overrides });
  return cwd;
}

const migrate = (cwd: string) =>
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

const written = (ctx: MigrationContext) =>
  ctx.edits.filter((edit) => edit.kind === 'write');
const emittedResolvers = (ctx: MigrationContext) =>
  written(ctx).filter((edit) => /get(Locale|Region)\.ts$/.test(edit.path));
const forceDynamicEdits = (ctx: MigrationContext) =>
  written(ctx)
    .filter((edit) => (edit.content ?? '').includes('force-dynamic'))
    .map((edit) => edit.path);
const warningText = (ctx: MigrationContext) => (ctx.warnings ?? []).join('\n');
const deletions = (ctx: MigrationContext) =>
  ctx.edits.filter((edit) => edit.kind === 'delete').map((edit) => edit.path);

const nextIntlConfigFiles = {
  'src/i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    '});'
  ),
  'src/i18n/request.ts': lines(
    "import { getRequestConfig } from 'next-intl/server';",
    "import { routing } from './routing';",
    'export default getRequestConfig(async ({ requestLocale }) => {',
    '  const requested = await requestLocale;',
    '  const locale = routing.locales.includes(requested)',
    '    ? requested',
    '    : routing.defaultLocale;',
    '  return {',
    '    locale,',
    '    messages: (await import(`../../messages/${locale}.json`)).default,',
    '  };',
    '});'
  ),
  'next.config.ts': lines(
    "import createNextIntlPlugin from 'next-intl/plugin';",
    'const withNextIntl = createNextIntlPlugin();',
    'const nextConfig = {};',
    'export default withNextIntl(nextConfig);'
  ),
};

describe('round 9 F1: a client index barrel is not invisible to the hazard scan', () => {
  it.each([
    ['aliased import', '@/widgets/Widget'],
    ['relative import', '../../../widgets/Widget'],
  ])(
    'detects the hazard through a %s of a use-client index.tsx',
    async (_label, specifier) => {
      const cwd = makeApp({
        'src/widgets/Widget/index.tsx': clientWidget,
        'src/app/[locale]/about/page.tsx': serverPage(specifier),
      });
      const ctx = await migrate(cwd);

      // Pre-fix: hazards === 0, no containment, no warning. The route that
      // renders the hazard was prerendered and `next build` would fail on it.
      expect(ctx.latentClientCallHazards).toHaveLength(1);
      expect(ctx.latentClientCallHazards![0]).toMatchObject({
        caller: path.join(cwd, 'src/app/[locale]/about/page.tsx'),
        importedName: 'useWidgetTitle',
        clientModule: path.join(cwd, 'src/widgets/Widget/index.tsx'),
      });
      expect(forceDynamicEdits(ctx)).toEqual([
        path.join(cwd, 'src/app/[locale]/about/page.tsx'),
      ]);
      expect(emittedResolvers(ctx)).toHaveLength(2);
    }
  );

  it('still reports the barrel hazard in the report', async () => {
    const cwd = makeApp({
      'src/widgets/Widget/index.tsx': clientWidget,
      'src/app/[locale]/about/page.tsx': serverPage('@/widgets/Widget'),
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('widgets/Widget/index.tsx');
    expect(report).toContain('held dynamic');
  });
});

describe('round 9 F2: containment is not trusted on an incomplete graph', () => {
  const clientLabels = lines(
    "'use client';",
    "import { useTranslations } from 'next-intl';",
    'export function useLocalizedLabel() {',
    "  const t = useTranslations('Labels');",
    '  return (value: string) => t(value);',
    '}'
  );
  const hazardModule = lines(
    "import { useLocalizedLabel } from '@/i18n/labels';",
    'export function shout(value: string) {',
    '  const localize = useLocalizedLabel();',
    '  return localize(value).toUpperCase();',
    '}'
  );
  const consumer = (specifier: string, name: string) =>
    lines(
      `import { shout } from '${specifier}';`,
      `export default function ${name}() {`,
      "  return <p>{shout('x')}</p>;",
      '}'
    );
  const containmentFiles = {
    'src/i18n/labels.ts': clientLabels,
    'src/lib/hazard.ts': hazardModule,
  };

  it('contains both routes when every reaching edge resolves', async () => {
    const cwd = makeApp({
      ...containmentFiles,
      'src/app/[locale]/a/page.tsx': consumer('../../../lib/hazard', 'A'),
      'src/app/[locale]/b/page.tsx': consumer('../../../lib/hazard', 'B'),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards![0].reachSetIncomplete).toBeUndefined();
    expect(forceDynamicEdits(ctx).sort()).toEqual([
      path.join(cwd, 'src/app/[locale]/a/page.tsx'),
      path.join(cwd, 'src/app/[locale]/b/page.tsx'),
    ]);
    expect(emittedResolvers(ctx)).toHaveLength(2);
  });

  it('withholds the resolvers when a second route reaches the hazard through an unresolvable specifier', async () => {
    const cwd = makeApp({
      ...containmentFiles,
      'src/app/[locale]/a/page.tsx': consumer('../../../lib/hazard', 'A'),
      // Pre-fix: this route stayed prerendered while /a was held dynamic, and
      // the run claimed "Every other route keeps static rendering (SSG)".
      'src/app/[locale]/b/page.tsx': consumer('@svc/hazard', 'B'),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards![0].reachSetIncomplete).toBe(
      path.join(cwd, 'src/lib/hazard.ts')
    );
    expect(forceDynamicEdits(ctx)).toEqual([]);
    expect(emittedResolvers(ctx)).toEqual([]);
    expect(warningText(ctx)).toContain('static rendering NOT restored');
    expect(warningText(ctx)).toContain('could not be resolved');
    expect(buildReport(ctx, false, false)).toContain('could not be resolved');
  });

  it('withholds when the unresolvable specifier names an importer rather than the hazard itself', async () => {
    const cwd = makeApp({
      ...containmentFiles,
      'src/app/[locale]/a/page.tsx': consumer('../../../lib/hazard', 'A'),
      // b -> wrapper is unresolvable; wrapper -> hazard resolves, so only the
      // closure walk (not the hazard file's own name) can see the hole.
      'src/app/[locale]/b/page.tsx': consumer('@svc/wrapper', 'B'),
      'src/lib/wrapper.ts': lines(
        "import { shout } from './hazard';",
        'export const loud = (value: string) => shout(value);'
      ),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards![0].reachSetIncomplete).toBe(
      path.join(cwd, 'src/lib/wrapper.ts')
    );
    expect(emittedResolvers(ctx)).toEqual([]);
  });

  it("resolves a NodeNext '.js' specifier instead of losing the edge", async () => {
    const cwd = makeApp({
      ...containmentFiles,
      'src/app/[locale]/a/page.tsx': consumer('../../../lib/hazard', 'A'),
      'src/app/[locale]/b/page.tsx': consumer('../../../lib/hazard.js', 'B'),
    });
    const ctx = await migrate(cwd);

    // Pre-fix: '.js' resolved to nothing, so /b kept static rendering with the
    // hazard in its graph. Resolving it contains both routes instead.
    expect(ctx.latentClientCallHazards![0].reachSetIncomplete).toBeUndefined();
    expect(forceDynamicEdits(ctx).sort()).toEqual([
      path.join(cwd, 'src/app/[locale]/a/page.tsx'),
      path.join(cwd, 'src/app/[locale]/b/page.tsx'),
    ]);
    expect(emittedResolvers(ctx)).toHaveLength(2);
  });
});

describe('round 9 F3: test-file classification ignores directories above the project', () => {
  const page = lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Home() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  );

  it.each(['tests', 'e2e', '__mocks__'])(
    'converts the app normally when the checkout sits under %s/',
    async (segment) => {
      const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-r9pe-'));
      tmpDirs.push(parent);
      const root = path.join(parent, segment);
      const cwd = makeApp({ 'src/app/[locale]/page.tsx': page }, { root });
      const ctx = await migrate(cwd);

      // Pre-fix: every file was a "test file", nothing was converted, and the
      // report told the user their layout.tsx depends on test wiring.
      expect(ctx.testFilesNeedingMigration ?? []).toEqual([]);
      expect([...ctx.skippedFiles.keys()]).toEqual([]);
      expect(
        written(ctx).map((edit) => path.relative(cwd, edit.path))
      ).toContain(path.join('src', 'app', '[locale]', 'page.tsx'));
      expect(warningText(ctx)).not.toContain('test file(s) depend on');
    }
  );

  it('still classifies a real tests/ directory inside the project', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': page,
      'tests/setup.ts': lines(
        "import { vi } from 'vitest';",
        "vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));"
      ),
    });
    const ctx = await migrate(cwd);

    expect(
      (ctx.testFilesNeedingMigration ?? []).map((file) =>
        path.relative(cwd, file)
      )
    ).toContain(path.join('tests', 'setup.ts'));
  });
});

describe('round 9 F7: a setup file the path pattern does not name is still test wiring', () => {
  const page = lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Home() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  );
  const jestMock = lines(
    "jest.mock('next-intl', () => ({",
    '  useTranslations: () => (key: string) => key,',
    '}));'
  );

  it('routes src/setupTests.ts into the test stage, not the retained-wiring sweep', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': page,
      'src/setupTests.ts': jestMock,
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(
      (ctx.testFilesNeedingMigration ?? []).map((file) =>
        path.relative(cwd, file)
      )
    ).toEqual([path.join('src', 'setupTests.ts')]);
    expect(report).toContain('Tests need manual migration');
    // Pre-fix: the file appeared only under "Still referencing next-intl ...
    // they are retained wiring", the opposite of the truth.
    expect(report).not.toContain('Still referencing next-intl');
  });

  it('treats a mock in a file no naming convention covers as test wiring', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': page,
      'src/testing/bootstrap.ts': jestMock,
    });
    const ctx = await migrate(cwd);

    expect(
      (ctx.testFilesNeedingMigration ?? []).map((file) =>
        path.relative(cwd, file)
      )
    ).toEqual([path.join('src', 'testing', 'bootstrap.ts')]);
  });

  it('keeps a mock-only file out of the skip set, so teardown still runs', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': page,
      'src/setupTests.ts': jestMock,
      ...nextIntlConfigFiles,
    });
    const ctx = await migrate(cwd);

    expect([...ctx.skippedFiles.keys()]).toEqual([]);
    const packageEdit = written(ctx).find((edit) =>
      edit.path.endsWith('package.json')
    );
    expect(packageEdit?.content).not.toContain('next-intl');
  });
});

describe('round 9 F9: the teardown does not delete on an incomplete graph', () => {
  it('keeps a routing file imported through a tsconfig alias that does not mirror its path', async () => {
    const cwd = makeApp({
      ...nextIntlConfigFiles,
      'tsconfig.json': JSON.stringify({
        // Comments and a trailing comma are legal here; the reader tolerates
        // both the way tsc does.
        compilerOptions: {
          baseUrl: '.',
          paths: { '#config': ['./src/i18n/routing.ts'] },
        },
      }),
      'src/lib/links.ts': lines(
        "import { routing } from '#config';",
        'export const homeHref = `/${routing.defaultLocale}`;'
      ),
    });
    const ctx = await migrate(cwd);

    // Pre-fix: both config files were deleted and src/lib/links.ts was left
    // with a dangling import.
    expect(deletions(ctx)).not.toContain(path.join(cwd, 'src/i18n/routing.ts'));
    expect(
      ctx.todos.find(
        (todo) => todo.file === path.join(cwd, 'src/i18n/routing.ts')
      )?.reason
    ).toContain('links.ts');
  });

  it('keeps a routing file when an unresolvable specifier could name it', async () => {
    const cwd = makeApp({
      ...nextIntlConfigFiles,
      // No tsconfig: '@svc/routing' resolves nowhere, and its tail could name
      // src/i18n/routing.ts, so the file is not safe to delete.
      'src/lib/links.ts': lines(
        "import { routing } from '@svc/routing';",
        'export const homeHref = `/${routing.defaultLocale}`;'
      ),
    });
    const ctx = await migrate(cwd);

    expect(deletions(ctx)).not.toContain(path.join(cwd, 'src/i18n/routing.ts'));
    expect(
      ctx.todos.find(
        (todo) => todo.file === path.join(cwd, 'src/i18n/routing.ts')
      )?.reason
    ).toContain('could not resolve');
  });

  it('still deletes the config files when the graph is complete', async () => {
    const cwd = makeApp({
      ...nextIntlConfigFiles,
      'src/lib/links.ts': lines("export const homeHref = '/en';"),
    });
    const ctx = await migrate(cwd);

    expect(deletions(ctx).sort()).toEqual([
      path.join(cwd, 'src/i18n/request.ts'),
      path.join(cwd, 'src/i18n/routing.ts'),
    ]);
  });
});

describe('round 9 F10: an unreadable project file does not abort the run', () => {
  // Only meaningful for a user who cannot read the file; root always can.
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

  it.skipIf(asRoot)(
    'finishes the migration and keeps the config files it could not clear',
    async () => {
      const cwd = makeApp({
        ...nextIntlConfigFiles,
        // Outside the source globs, so the scan's own guarded read never sees
        // it and the emit phase's importer scan is the first to open it.
        'scripts/unreadable.ts': 'export const x = 1;\n',
      });
      const unreadable = path.join(cwd, 'scripts/unreadable.ts');
      fs.chmodSync(unreadable, 0o000);
      try {
        // Pre-fix: this threw EACCES out of emitGtFiles and the run died.
        const ctx = await migrate(cwd);
        expect(written(ctx).length).toBeGreaterThan(0);
        expect(deletions(ctx)).toEqual([]);
        expect(
          ctx.todos.find(
            (todo) => todo.file === path.join(cwd, 'src/i18n/routing.ts')
          )?.reason
        ).toContain('could not read');
      } finally {
        fs.chmodSync(unreadable, 0o644);
      }
    }
  );
});

describe('round 9 R1 #1: converted keys missing from the catalog are reported', () => {
  const aboutPage = lines(
    "import { useTranslations } from 'next-intl';",
    'export default function About() {',
    "  const t = useTranslations('UI');",
    "  return <p>{t('show')}</p>;",
    '}'
  );

  it('names the file, line, and key when the key is not in the catalog', async () => {
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': aboutPage,
      'messages/en.json': JSON.stringify({
        Home: { title: 'Welcome' },
        UI: { hide: 'Hide' },
      }),
      'messages/es.json': JSON.stringify({
        Home: { title: 'Bienvenido' },
        UI: { hide: 'Ocultar' },
      }),
    });
    const ctx = await migrate(cwd);
    const todo = ctx.todos.find((entry) => entry.reason.includes('UI.show'));

    // Pre-fix: nothing at all. The migrated page returned a 500 (or failed the
    // build where it prerendered) with no mention in the report.
    expect(todo).toBeDefined();
    expect(todo!.file).toBe(path.join(cwd, 'src/app/[locale]/about/page.tsx'));
    expect(todo!.line).toBe(4);
    expect(todo!.reason).toContain('cannot be found');
    expect(warningText(ctx)).toContain('converted call site(s)');
    expect(buildReport(ctx, false, false)).toContain('UI.show');
  });

  it('says nothing when every converted key resolves', async () => {
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': aboutPage,
      'messages/en.json': JSON.stringify({
        Home: { title: 'Welcome' },
        UI: { show: 'Show' },
      }),
      'messages/es.json': JSON.stringify({
        Home: { title: 'Bienvenido' },
        UI: { show: 'Mostrar' },
      }),
    });
    const ctx = await migrate(cwd);

    expect(
      ctx.todos.filter((entry) => entry.reason.includes('UI.show'))
    ).toEqual([]);
    expect(warningText(ctx)).not.toContain('converted call site(s)');
  });

  it('says nothing about a key it cannot resolve statically', async () => {
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': lines(
        "import { useTranslations } from 'next-intl';",
        'export default function About({ which }: { which: string }) {',
        "  const t = useTranslations('UI');",
        '  return <p>{t(which)}</p>;',
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(warningText(ctx)).not.toContain('converted call site(s)');
  });

  it('does not attribute a shadowed local to the wrong namespace', async () => {
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': lines(
        "import { useTranslations } from 'next-intl';",
        'export function Present() {',
        "  const t = useTranslations('Home');",
        "  return <p>{t('title')}</p>;",
        '}',
        'export default function About() {',
        '  const t = (key: string) => key;',
        "  return <p>{t('not-a-dictionary-key')}</p>;",
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(warningText(ctx)).not.toContain('converted call site(s)');
  });
});

describe('round 9 R1 #2: re-running the migration does not stack config wrappers', () => {
  it('wraps once and reports "already wired" on the second run', async () => {
    const cwd = makeApp({
      ...nextIntlConfigFiles,
      // A skipped file keeps next-intl installed, which is the state the
      // report's own "re-run to finish the teardown" advice starts from.
      'src/lib/legacy.ts': lines(
        "import { useFormatter } from 'next-intl';",
        'export const f = useFormatter;'
      ),
    });
    const configPath = path.join(cwd, 'next.config.ts');

    const first = await migrate(cwd);
    applyEdits(first.edits);
    const afterFirst = fs.readFileSync(configPath, 'utf8');
    expect(afterFirst.match(/withGTConfig\(/g)).toHaveLength(1);

    const second = await migrate(cwd);
    applyEdits(second.edits);
    const afterSecond = fs.readFileSync(configPath, 'utf8');

    // Pre-fix: run 2 produced withGTConfig(withGTConfig(nextConfig, {...}), {...}),
    // and every further run added another.
    expect(afterSecond.match(/withGTConfig\(/g)).toHaveLength(1);
    expect(afterSecond).toBe(afterFirst);
    expect(
      second.todos.find((todo) => todo.file === configPath)?.reason
    ).toContain('already wired');

    const third = await migrate(cwd);
    applyEdits(third.edits);
    expect(
      fs.readFileSync(configPath, 'utf8').match(/withGTConfig\(/g)
    ).toHaveLength(1);
  });

  it('finishes the teardown on a re-run once nothing uses next-intl', async () => {
    const cwd = makeApp({
      ...nextIntlConfigFiles,
      'src/lib/legacy.ts': lines(
        "import { useFormatter } from 'next-intl';",
        'export const f = useFormatter;'
      ),
    });
    const configPath = path.join(cwd, 'next.config.ts');
    const first = await migrate(cwd);
    applyEdits(first.edits);
    expect(fs.readFileSync(configPath, 'utf8')).toContain('withNextIntl(');

    // The user does what the report asked: converts the last holdout by hand.
    fs.writeFileSync(
      path.join(cwd, 'src/lib/legacy.ts'),
      lines('export const f = () => undefined;')
    );
    const second = await migrate(cwd);
    applyEdits(second.edits);
    const afterSecond = fs.readFileSync(configPath, 'utf8');

    expect(afterSecond.match(/withGTConfig\(/g)).toHaveLength(1);
    expect(afterSecond).not.toContain('withNextIntl');
    expect(afterSecond).not.toContain('next-intl/plugin');
  });
});
