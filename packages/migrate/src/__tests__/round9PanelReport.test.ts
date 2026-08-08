import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMigration } from '../pipeline/runMigration.js';
import { buildReport } from '../report/report.js';
import { makeCapturedIO, type CapturedIO } from './support/io.js';
import { makeTree, registerTreeCleanup } from './support/tree.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// Round-9 panel round 2 (2026-07-24): the claims audit and the code adversary
// read the text this tool emits against the tree it emits, and found sentences
// that are wrong about that tree or about gt-next:
//
//  - the metadata TODO advised `options.$locale`, which type-checks, builds, and
//    changes nothing on gt-next 11.1.0 (measured on a real app: /en metadata
//    stayed English);
//  - the last next step, bare `npx gt generate`, writes 2-byte `{}` catalogs on
//    the tree the same run emitted (the gt CLI reads a dictionary from
//    --dictionary or ./dictionary.*, not from gt.config.json/next.config);
//  - the run-level warning counted test FILES and predicted that many failing
//    SUITES (4 vs the 3 that actually fail; a config-wired setup file is never
//    collected);
//  - nothing said that a retained provider leaves both catalogs in every page;
//  - the "files importing a left-unchanged module" section was gated to
//    react-i18next, so a next-intl run never named the 19 files still importing
//    the retained navigation wrapper, and it resolved relative specifiers only,
//    so an '@/i18n/navigation' import found nothing;
//  - the <Link> bullet asserted gt-next/link behavior in a tree that never
//    imports it, and the router half was gated on the emitted FILENAME
//    (navigation.client.*) although the wrapper is found by content;
//  - "## Converted" listed files the run CREATED;
//  - a re-run claimed credit for adding `export const dynamic` to files it did
//    not touch;
//  - the reference sweep had no left boundary, so `lib/meta.ts` vanished into
//    `src/lib/meta.ts`;
//  - the pre-flight line said catalogs were "found in" a directory that does not
//    exist (react-intl/react-i18next repoint `catalogs.dir` at their output).
//
// Every test drives the REAL pipeline against a real tmpdir project; nothing
// hand-populates a MigrationContext.

registerTreeCleanup();

const writeTree = (files: Record<string, string>) =>
  makeTree(files, { prefix: 'gt-r9-panel-' });

async function migrate(
  cwd: string,
  from = 'next-intl'
): Promise<{ ctx: MigrationContext; io: CapturedIO }> {
  const io = makeCapturedIO();
  const ctx = await runMigration(
    {
      config: 'gt.config.json',
      from,
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    from,
    io.io,
    cwd
  );
  return { ctx, io };
}

/** Applies the buffered edits the way the CLI does, for real re-run tests. */
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

const lines = (...parts: string[]) => parts.join('\n');
const warningText = (ctx: MigrationContext) => (ctx.warnings ?? []).join('\n');
const section = (report: string, heading: string) =>
  report.split(heading)[1]?.split('\n## ')[0] ?? '';
const todoReasons = (ctx: MigrationContext) =>
  ctx.todos.map((todo) => todo.reason).join('\n');

// A layout that hands the retained provider its own messages (the shape every
// next-intl App Router app ships, and the one the payload claim is about).
const localeLayout = lines(
  "import { NextIntlClientProvider } from 'next-intl';",
  "import { getMessages, setRequestLocale } from 'next-intl/server';",
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

const packageJson = JSON.stringify({
  name: 'demo',
  dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
});

const baseApp: Record<string, string> = {
  'package.json': packageJson,
  'tsconfig.json': JSON.stringify({
    compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } },
  }),
  'messages/en.json': JSON.stringify({
    Home: { title: 'Welcome' },
    Metadata: { title: 'Demo', description: 'A demo' },
  }),
  'messages/es.json': JSON.stringify({
    Home: { title: 'Bienvenido' },
    Metadata: { title: 'Demo es', description: 'Una demo' },
  }),
  'src/i18n/routing.ts': lines(
    "import { defineRouting } from 'next-intl/routing';",
    'export const routing = defineRouting({',
    "  locales: ['en', 'es'],",
    "  defaultLocale: 'en',",
    '});'
  ),
  'src/app/[locale]/layout.tsx': localeLayout,
  'src/app/[locale]/page.tsx': lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Home() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
};

// t.rich always skips its file, which retains next-intl and keeps the run in
// partial mode (a retained provider, a "Needs manual migration" section).
const richPage = lines(
  "import { useTranslations } from 'next-intl';",
  'export default function Rich() {',
  "  const t = useTranslations('Home');",
  "  return <p>{t.rich('title', { b: (chunk) => <b>{chunk}</b> })}</p>;",
  '}'
);

describe('round 9 panel: the dropped getTranslations locale override', () => {
  it('does not advise options.$locale, and names what actually works', async () => {
    const cwd = writeTree({
      ...baseApp,
      'src/app/[locale]/about/page.tsx': lines(
        "import { getTranslations } from 'next-intl/server';",
        'export async function generateMetadata({',
        '  params,',
        '}: {',
        '  params: Promise<{ locale: string }>;',
        '}) {',
        '  const { locale } = await params;',
        "  const t = await getTranslations({ locale, namespace: 'Metadata' });",
        "  return { title: t('title'), description: t('description') };",
        '}',
        'export default function About() {',
        '  return <h1>About</h1>;',
        '}'
      ),
    });
    const { ctx } = await migrate(cwd);
    const reasons = todoReasons(ctx);

    expect(reasons).toContain('getTranslations locale override dropped');
    // Measured on gt-next 11.1.0 (sniply, `npx next build` rc=0): with
    // `t('title', { $locale: 'es' })` the /en <title> stayed English, byte
    // identical to the run without it, and `tsc --noEmit` was clean. Advice
    // that silently does nothing must not ship.
    expect(reasons).not.toContain('use options.$locale');
    expect(reasons).toContain('no per-call locale override for dictionary');
    expect(reasons).toContain('silently changes nothing');
    // The two remediations that were measured to work: the request-locale
    // resolution needs nothing, and a genuinely fixed locale reads its catalog.
    expect(reasons).toContain('needs no replacement');
    expect(reasons).toContain('index the key');
  });
});

describe('round 9 panel: the final next step works on the emitted tree', () => {
  // UPDATED in round-9 panel round 4 (finding B1). The original pin was written
  // against 27ffc9eb7, where bare `npx gt generate` printed "No inline content
  // or dictionaries were found" and wrote 2-byte `{}` files, so the step named
  // --dictionary and called the flag required. The SAME commit that fixed the
  // report (10bf65775) also taught the engine to record `dictionary` in
  // gt.config.json and gt generate to honor it, which made the justification
  // false on the tree the run emits: re-measured, bare `npx gt generate` writes
  // the full 52,826-byte templates, byte-identical to the run with the flag.
  // The property under test is unchanged (the final step must work on the
  // emitted tree); only the command that satisfies it moved.
  it('names the command that works on the tree, and the config it recorded', async () => {
    const cwd = writeTree(baseApp);
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('`npx gt generate` (no API key)');
    expect(report).toContain('"dictionary": "./messages/en.json"');
    expect(report).not.toContain('The flag is required');
    expect(report).not.toContain(
      'No inline content or dictionaries were found'
    );
  });
});

describe('round 9 panel: the test-stage count and its failure prediction', () => {
  const testWiringApp = () =>
    writeTree({
      ...baseApp,
      'vitest.config.ts': lines(
        "import { defineConfig } from 'vitest/config';",
        'export default defineConfig({',
        "  test: { setupFiles: ['./tests/setup.ts'] },",
        '});'
      ),
      'tests/setup.ts': lines(
        "import { vi } from 'vitest';",
        'vi.mock("next-intl", () => ({',
        '  useTranslations: () => (key: string) => key,',
        '}));'
      ),
      'src/components/Widget.tsx': lines(
        "import { useTranslations } from 'next-intl';",
        'export function Widget() {',
        "  const t = useTranslations('Home');",
        "  return <span>{t('title')}</span>;",
        '}'
      ),
      'tests/components/Widget.test.tsx': lines(
        "import { Widget } from '../../src/components/Widget';",
        "it('renders', () => {",
        '  expect(Widget).toBeDefined();',
        '});'
      ),
    });

  it('counts files, predicts failures only for the suites among them', async () => {
    const cwd = testWiringApp();
    const { ctx } = await migrate(cwd);
    const flagged = ctx.testFilesNeedingMigration ?? [];
    const warnings = warningText(ctx);

    // No file is suppressed: the count still covers every flagged file,
    // including the setup file vitest wires by config.
    expect(flagged.length).toBeGreaterThan(1);
    expect(flagged.some((file) => file.endsWith('setup.ts'))).toBe(true);
    expect(warnings).toContain(`${flagged.length} test file(s) depend on`);
    // Measured on sniply: 4 flagged files, 3 failing suites, because
    // tests/setup.ts is a setupFiles entry excluded from the collection glob.
    expect(warnings).not.toContain('those suites FAIL');
    expect(warnings).toContain(
      'suites among them that exercise converted code FAIL'
    );
    expect(warnings).toContain('not itself a collected suite');

    const report = buildReport(ctx, false, false);
    const stage = section(report, '## Tests need manual migration');
    expect(stage).toContain(`${flagged.length} test file(s) depend on`);
    expect(stage).not.toContain('so these suites WILL');
    expect(stage).toContain('the collected suites WILL fail');
    expect(stage).toContain('is not collected as a suite');
  });
});

describe('round 9 panel: the retained provider ships both catalogs', () => {
  it('discloses the per-page payload while the provider still renders', async () => {
    const cwd = writeTree({
      ...baseApp,
      'src/app/[locale]/rich/page.tsx': richPage,
    });
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);
    const differences = section(
      report,
      '## Behavior differences to know about'
    );

    // Measured (sniply, baseline vs after): 0 of 32 prerendered pages
    // byte-identical, en pages +53 KB (en.json is 55 KB), es pages +112 KB
    // (both catalogs are 117 KB), same distinct key count and same visible
    // text. The claim is sized in catalog files, not in a made-up number.
    expect(differences).toContain(
      'Both catalogs ship in every page while NextIntlClientProvider still renders'
    );
    expect(differences).toContain(
      'roughly one extra catalog file worth of HTML'
    );
    // UPDATED in round-9 panel round 4 (finding B3.3): "removes the duplicate
    // payload" was measurably false at 10bf65775, because the teardown re-run
    // nested a second GTProvider (B4). With that fixed the clause is true and
    // now states what was measured on each locale.
    expect(differences).toContain("removes that provider's copy");
  });

  it('says nothing about payload when no provider is retained', async () => {
    const cwd = writeTree(baseApp);
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).not.toContain('## Needs manual migration');
    expect(report).not.toContain('Both catalogs ship in every page');
  });
});

// ---------------------------------------------------------------------------
// The retained-navigation-wrapper shape: a locale-aware call signature holds
// the wrapper on next-intl, and its consumers import it through a path alias.
// ---------------------------------------------------------------------------

const heldWrapperApp = () =>
  writeTree({
    ...baseApp,
    'src/i18n/navigation.ts': lines(
      "import { createNavigation } from 'next-intl/navigation';",
      "import { routing } from './routing';",
      'export const { Link, redirect, usePathname, useRouter } =',
      '  createNavigation(routing);'
    ),
    // next-intl's locale-aware signature: this file skips and the wrapper is
    // held so the call keeps resolving.
    'src/components/LocaleSwitcher.tsx': lines(
      "'use client';",
      "import { useRouter, usePathname } from '@/i18n/navigation';",
      'export default function LocaleSwitcher() {',
      '  const router = useRouter();',
      '  const pathname = usePathname();',
      '  return (',
      "    <button onClick={() => router.replace(pathname, { locale: 'es' })}>",
      '      es',
      '    </button>',
      '  );',
      '}'
    ),
    // A consumer that imports the held wrapper through the alias. Its own
    // next-intl import converts, so it lands under Converted while its Link
    // still runs through next-intl.
    'src/components/Nav.tsx': lines(
      "import { useTranslations } from 'next-intl';",
      "import { Link } from '@/i18n/navigation';",
      'export function Nav() {',
      "  const t = useTranslations('Home');",
      "  return <Link href='/'>{t('title')}</Link>;",
      '}'
    ),
  });

describe('round 9 panel: files importing a left-unchanged module', () => {
  it('names alias-imported consumers of a retained wrapper on a next-intl run', async () => {
    const cwd = heldWrapperApp();
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    // The wrapper really is retained and really is a skip.
    const skipped = [...ctx.skippedFiles.keys()].map((file) =>
      path.relative(cwd, file).split(path.sep).join('/')
    );
    expect(skipped).toContain('src/i18n/navigation.ts');

    const consumers = section(
      report,
      '## Files importing a left-unchanged module'
    );
    expect(consumers).toContain('src/components/Nav.tsx');
    expect(consumers).toContain('imports src/i18n/navigation.ts');
    expect(consumers).toContain('still runs through next-intl');
    // Nav.tsx is listed as Converted (its own next-intl import was converted),
    // which is exactly why the consumers list has to exist.
    expect(section(report, '## Converted')).toContain('src/components/Nav.tsx');
  });

  it('omits the gt-next/link claim in a tree that never imports it', async () => {
    const cwd = heldWrapperApp();
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    const emitted = ctx.edits
      .filter((edit) => edit.kind === 'write')
      .map((edit) => edit.content ?? '')
      .join('\n');
    expect(emitted).not.toContain('gt-next/link');
    const differences = section(
      report,
      '## Behavior differences to know about'
    );
    // The retained next-intl wrapper still prefixes router.push/redirect, so
    // the blanket "not locale-prefixed" sentence would send a user
    // hand-prefixing into /es/es/... (round-10 claims finding 2).
    expect(differences).toContain(
      'still runs through the retained next-intl navigation wrapper'
    );
    expect(differences).toContain('do not add locale prefixes by hand');
    expect(differences).not.toContain(
      'Programmatic navigation (redirect, router.push) is not locale-prefixed automatically.'
    );
    expect(differences).not.toContain('gt-next/link');
  });
});

describe('round 9 panel: the navigation sentence follows content, not filenames', () => {
  const convertingWrapperApp = (wrapperBase: string) =>
    writeTree({
      ...baseApp,
      [`src/i18n/${wrapperBase}.ts`]: lines(
        "import { createNavigation } from 'next-intl/navigation';",
        "import { routing } from './routing';",
        'export const { Link, redirect, usePathname, useRouter } =',
        '  createNavigation(routing);'
      ),
      'src/components/Search.tsx': lines(
        "'use client';",
        `import { useRouter } from '@/i18n/${wrapperBase}';`,
        'export function Search() {',
        '  const router = useRouter();',
        "  return <button onClick={() => router.push('/results')}>go</button>;",
        '}'
      ),
    });

  it.each(['navigation', 'nav'])(
    'credits the generated router wrapper emitted as %s.client.ts',
    async (wrapperBase) => {
      const cwd = convertingWrapperApp(wrapperBase);
      const { ctx } = await migrate(cwd);
      const companion = ctx.edits.find(
        (edit) =>
          edit.kind === 'write' &&
          edit.path.endsWith(`${wrapperBase}.client.ts`)
      );
      expect(companion?.content).toContain('export function useRouter()');

      const report = buildReport(ctx, false, false);
      const differences = section(
        report,
        '## Behavior differences to know about'
      );
      // The wrapper prefixes router.push here, so the blanket sentence would be
      // false in both directions (it also hides that redirect specifically is
      // the unprefixed one).
      expect(differences).toContain(
        'Server redirects (redirect, permanentRedirect) are not locale-prefixed'
      );
      expect(differences).toContain(
        'keeps useRouter().push/replace/prefetch prefixed'
      );
      expect(differences).not.toContain('Programmatic navigation (redirect');
      // gt-next/link IS imported by the converted wrapper here, so the Link
      // clause is allowed to ship.
      expect(differences).toContain('<Link> from gt-next/link is prefixed');
    }
  );
});

describe('round 9 panel: the reference sweep bounds both edges of a path', () => {
  it('names a root file whose path is a suffix of an already-named file', async () => {
    const cwd = writeTree({
      ...baseApp,
      // Named in the report: createTranslator has no conversion, so this file
      // is left untouched and listed under "Needs manual migration".
      'src/lib/meta.ts': lines(
        "import { createTranslator } from 'next-intl';",
        "export const t = createTranslator({ locale: 'en', messages: {} });"
      ),
      // Out of the default scan scope, still references next-intl, and its path
      // is a right-hand substring of the file above.
      'lib/meta.ts': "export const SOURCE_LIB = 'next-intl';",
    });
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('src/lib/meta.ts');
    const sweep = section(report, '## Still referencing next-intl');
    expect(sweep).toContain('- lib/meta.ts');
    // The other direction: a file already named above is not repeated here.
    expect(sweep).not.toContain('src/lib/meta.ts');
  });
});

describe('round 9 panel: created files are not called converted', () => {
  it('lists the emitted gt-next wiring under Created', async () => {
    const cwd = writeTree(baseApp);
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    const created = section(report, '## Created (new files this run added)');
    const converted = section(report, '## Converted');
    for (const file of [
      'src/loadDictionary.ts',
      'src/getLocale.ts',
      'src/getRegion.ts',
    ]) {
      // The file really is new: it is written, and it was in neither pre-run
      // scan set.
      const abs = path.join(cwd, file);
      expect(
        ctx.edits.some((edit) => edit.kind === 'write' && edit.path === abs)
      ).toBe(true);
      expect(ctx.projectFiles ?? []).not.toContain(abs);
      expect(created).toContain(`- ${file}`);
      expect(converted).not.toContain(`- ${file}`);
    }
    // A file that existed and was rewritten stays under Converted.
    expect(converted).toContain('- src/app/[locale]/page.tsx');
  });
});

// ---------------------------------------------------------------------------
// Containment wording: a route that already carries the export was not written
// by this run, and a re-run must not claim credit for it.
// ---------------------------------------------------------------------------

const clientLabels = lines(
  "'use client';",
  "import { useTranslations } from 'next-intl';",
  'export function useLocalizedLabel() {',
  "  const t = useTranslations('Home');",
  '  return (value: string) => t(value);',
  '}'
);

const hazardRoute = (prelude: string[] = []) =>
  lines(
    "import { useLocalizedLabel } from '@/i18n/labels';",
    ...prelude,
    'export default function Page() {',
    '  const localize = useLocalizedLabel();',
    "  return <h1>{localize('title')}</h1>;",
    '}'
  );

describe('round 9 panel: containment says which routes it wrote', () => {
  it('distinguishes an export it added from one already present', async () => {
    const cwd = writeTree({
      ...baseApp,
      'src/i18n/labels.ts': clientLabels,
      'src/app/[locale]/about/page.tsx': hazardRoute([
        'export const dynamic = "force-dynamic";',
      ]),
      'src/app/[locale]/terms/page.tsx': hazardRoute(),
    });
    const { ctx } = await migrate(cwd);
    const warnings = warningText(ctx);

    expect(warnings).toContain('route(s) held dynamic');
    expect(warnings).toContain(
      '`export const dynamic = "force-dynamic"` is already present (kept as is, not written by this run) on /[locale]/about'
    );
    expect(warnings).toContain(
      'gt migrate adds `export const dynamic = "force-dynamic"` to /[locale]/terms'
    );
  });

  it('claims no insertion on a re-run over an already-migrated tree', async () => {
    const cwd = writeTree({
      ...baseApp,
      'src/i18n/labels.ts': clientLabels,
      'src/app/[locale]/about/page.tsx': hazardRoute(),
      // A skip keeps next-intl installed, so the re-run has a source library to
      // migrate from (the sniply shape the audit re-ran on).
      'src/app/[locale]/rich/page.tsx': richPage,
    });
    const first = await migrate(cwd);
    expect(warningText(first.ctx)).toContain('gt migrate adds');
    applyEdits(first.ctx.edits);

    const second = await migrate(cwd);
    const warnings = warningText(second.ctx);
    expect(warnings).toContain('route(s) held dynamic');
    expect(warnings).toContain(
      'is already present (kept as is, not written by this run)'
    );
    expect(warnings).not.toContain('gt migrate adds');
  });
});

describe('round 9 panel: the pre-flight catalog line', () => {
  it('does not claim catalogs were found in a directory it never read', async () => {
    const cwd = writeTree({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          react: '19.0.0',
          i18next: '^23.11.0',
          'react-i18next': '^14.1.0',
        },
      }),
      'public/locales/en/translation.json': JSON.stringify({
        title: 'Welcome',
      }),
      'public/locales/es/translation.json': JSON.stringify({
        title: 'Bienvenido',
      }),
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
    });
    const { ctx, io } = await migrate(cwd, 'react-i18next');
    const catalogLine = io.info.find((message) =>
      message.startsWith('Found catalogs for')
    );

    // The directory this adapter reports is its own OUTPUT dir; the catalogs
    // were read from public/locales/<locale>/. Naming it as the read location
    // pointed the user at a path that does not exist yet.
    //
    // UPDATED in round-9 panel round 4 (finding B8): the fix for this finding
    // dropped the "in <dir>" clause entirely, which then hid the discovery
    // location from a react-i18next user whose catalogs are somewhere else. The
    // line now prints BOTH, so the assertion is no longer "says nothing about
    // where they were found" but "the location it names as the read location is
    // the one it actually read".
    const reported = path.relative(cwd, ctx.catalogs.dir);
    expect(fs.existsSync(ctx.catalogs.dir)).toBe(false);
    expect(catalogLine).toBeDefined();
    expect(ctx.catalogs.sourceDir).toBe(path.join(cwd, 'public/locales'));
    expect(fs.existsSync(ctx.catalogs.sourceDir!)).toBe(true);
    expect(catalogLine).toContain('in public/locales/');
    expect(catalogLine).toContain(
      `catalog directory for the migration: ${reported}`
    );
  });

  it('still names the directory for an in-place next-intl catalog', async () => {
    const cwd = writeTree(baseApp);
    const { ctx, io } = await migrate(cwd);
    const catalogLine = io.info.find((message) =>
      message.startsWith('Found catalogs for')
    );

    expect(path.relative(cwd, ctx.catalogs.dir)).toBe('messages');
    expect(fs.existsSync(ctx.catalogs.dir)).toBe(true);
    expect(catalogLine).toContain(
      'catalog directory for the migration: messages'
    );
  });
});
