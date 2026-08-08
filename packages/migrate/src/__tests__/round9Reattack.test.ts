import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeCapturedIO, type CapturedIO } from './support/io.js';
import { makeTree, registerTreeCleanup, writeFiles } from './support/tree.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Round 9, panel round 4 (the re-attack lane). Each test pins one finding from
// R4, reproduced against the built engine at 10bf65775 before being fixed:
//
//  B4  the teardown the report itself prescribes (convert the files it names,
//      re-run gt migrate) renamed the retained provider to a SECOND
//      <GTProvider> INSIDE the first, so gt-next's dictionary shipped twice and
//      the duplicated payload the report promises the teardown removes survived
//      it (measured on sniply: 1,634 catalog-key occurrences before AND after
//      the teardown, against 817 at baseline).
//  B1  the Next-steps dictionary sentence said the --dictionary flag "is
//      required" and that the CLI does not read gt.config.json; the same commit
//      writes `dictionary` into gt.config.json and teaches gt generate to honor
//      it, so bare `npx gt generate` writes full templates on the emitted tree.
//  B3  the payload-growth bullet was gated on a `messages` attribute THIS RUN
//      wrote, so it stayed silent on the two provider shapes that carry no
//      messages prop (both measured growing) and vanished entirely on a re-run
//      over a tree that still carries both payloads; and it under-stated the
//      magnitude by ~2x on every non-default-locale page.
//  B2  the teardown deleted a config file whose only importer reached it through
//      a package.json "imports" subpath alias (F9's residual): Node, webpack and
//      Turbopack all honor those, and they are not a tsconfig concept.
//  B5  a package that is neither declared nor installed in cwd/node_modules was
//      classified as a project path, so a workspace app (installed at the repo
//      root) could lose static rendering project-wide.
//  B6  an unreadable project file blocks the teardown decision, and the report
//      filed the retained config files under generic "retained wiring" instead
//      of naming the file it could not read.
//  B7  template-literal keys were never named on a next-intl run, on an engine
//      that throws on an unknown key (memo-engine: 10 such call sites, 0 TODOs).
//  B8  catalog files the adapter synthesizes were absent from the Created
//      inventory, and the pre-flight line named the output directory only.
//
// Every test drives the REAL pipeline over a tmpdir project; nothing
// hand-populates a MigrationContext.
// ---------------------------------------------------------------------------

registerTreeCleanup();

const lines = (...parts: string[]) => parts.join('\n') + '\n';

/** A layout that hands the retained provider its own messages. */
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

/** The autohack/memo-engine shape: no messages prop, the provider inherits. */
const bareProviderLayout = localeLayout.replace(
  '<NextIntlClientProvider messages={messages}>',
  '<NextIntlClientProvider locale={locale}>'
);

const baseFiles: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'messages/en.json': JSON.stringify({
    Home: { title: 'Welcome' },
    UI: { step: { one: 'One', two: 'Two' } },
  }),
  'messages/es.json': JSON.stringify({
    Home: { title: 'Bienvenido' },
    UI: { step: { one: 'Uno', two: 'Dos' } },
  }),
  'src/app/[locale]/layout.tsx': localeLayout,
  'src/app/[locale]/page.tsx': lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Home() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
};

function makeApp(
  overrides: Record<string, string> = {},
  options: { root?: string; prefix?: string } = {}
): string {
  return makeTree(
    { ...baseFiles, ...overrides },
    { root: options.root, prefix: options.prefix ?? 'gt-migrate-r9r4-' }
  );
}

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

const LAYOUT = 'src/app/[locale]/layout.tsx';
const occurrences = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;
const written = (ctx: MigrationContext) =>
  ctx.edits.filter((edit) => edit.kind === 'write');
const deletions = (ctx: MigrationContext) =>
  ctx.edits.filter((edit) => edit.kind === 'delete').map((edit) => edit.path);
const warningText = (ctx: MigrationContext) => (ctx.warnings ?? []).join('\n');
const todoFor = (ctx: MigrationContext, cwd: string, relative: string) =>
  ctx.todos
    .filter((todo) => todo.file === path.join(cwd, relative))
    .map((todo) => todo.reason)
    .join('\n');
const differences = (report: string) =>
  report.split('## Behavior differences to know about')[1]?.split('\n## ')[0] ??
  '';

// t.rich always skips its file, which keeps next-intl installed and the run in
// partial mode: the layout keeps its provider, nested inside GTProvider.
const richPage = lines(
  "import { useTranslations } from 'next-intl';",
  'export default function Rich() {',
  "  const t = useTranslations('Home');",
  "  return <p>{t.rich('title', { b: (chunk) => <b>{chunk}</b> })}</p>;",
  '}'
);
const convertedRichPage = lines(
  "import { useTranslations } from 'gt-next';",
  'export default function Rich() {',
  "  const t = useTranslations('Home');",
  "  return <p>{t('title')}</p>;",
  '}'
);

describe('round 9 B4: the report-prescribed teardown does not nest a second GTProvider', () => {
  it('unwraps the retained provider on the re-run instead of renaming it', async () => {
    const cwd = makeApp({ 'src/app/[locale]/rich/page.tsx': richPage });

    // Run 1: partial. The provider is retained and nested inside GTProvider.
    const first = await migrate(cwd);
    applyEdits(first.ctx.edits);
    const afterFirst = fs.readFileSync(path.join(cwd, LAYOUT), 'utf8');
    expect(first.ctx.skippedFiles.size).toBe(1);
    expect(occurrences(afterFirst, '<GTProvider')).toBe(1);
    expect(occurrences(afterFirst, '<NextIntlClientProvider')).toBe(1);

    // The teardown the report prescribes: convert the file it names, re-run.
    fs.writeFileSync(
      path.join(cwd, 'src/app/[locale]/rich/page.tsx'),
      convertedRichPage
    );
    const second = await migrate(cwd);
    applyEdits(second.ctx.edits);
    const afterSecond = fs.readFileSync(path.join(cwd, LAYOUT), 'utf8');

    expect(second.ctx.skippedFiles.size).toBe(0);
    // Pre-fix this was 2: <GTProvider><GTProvider>{children}</GTProvider></…>,
    // which serializes the dictionary twice into every page.
    expect(occurrences(afterSecond, '<GTProvider')).toBe(1);
    expect(afterSecond).not.toContain('NextIntlClientProvider');
    // The unwrap must keep the children it was wrapping.
    expect(afterSecond).toContain('{children}');
    // One GTProvider import, from the run that inserted it; the unwrapping run
    // introduces no provider of its own and adds no second specifier.
    expect(occurrences(afterSecond, 'GTProvider')).toBe(3); // import + open + close
    // The teardown really did complete, so the remedy sentence is about a state
    // this engine reaches.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['next-intl']).toBeUndefined();
  });

  it('leaves the first-run swap alone (one GTProvider, imported once)', async () => {
    const cwd = makeApp();
    const { ctx } = await migrate(cwd);
    const layout = written(ctx).find((edit) =>
      edit.path.endsWith('layout.tsx')
    );
    const code = layout?.content ?? '';

    expect(code).not.toContain('NextIntlClientProvider');
    expect(occurrences(code, '<GTProvider')).toBe(1);
    expect(occurrences(code, 'GTProvider')).toBe(3);
    expect(code).toMatch(/from ['"]gt-next['"]/);
    expect(code).toContain('{children}');
  });

  it('unwraps a provider nested in an existing GTProvider in a plain component', async () => {
    // The same shape one file over: a client subtree a previous partial run left
    // holding the provider inside the GTProvider it inserted.
    const cwd = makeApp({
      'src/components/Shell.tsx': lines(
        "'use client';",
        "import { NextIntlClientProvider } from 'next-intl';",
        "import { GTProvider } from 'gt-next';",
        'export function Shell({ children, messages }) {',
        '  return (',
        '    <GTProvider>',
        '      <NextIntlClientProvider messages={messages}>',
        '        <div className="shell">{children}</div>',
        '      </NextIntlClientProvider>',
        '    </GTProvider>',
        '  );',
        '}'
      ),
    });
    const { ctx } = await migrate(cwd);
    const shell = written(ctx).find((edit) => edit.path.endsWith('Shell.tsx'));
    const code = shell?.content ?? '';

    expect(code).not.toContain('NextIntlClientProvider');
    expect(occurrences(code, '<GTProvider')).toBe(1);
    expect(code).toContain('className="shell"');
    expect(code).toContain('{children}');
  });
});

describe('round 9 B1: the dictionary step matches the config this run writes', () => {
  it('names the bare command and the gt.config.json key it recorded', async () => {
    const cwd = makeApp();
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);
    const config = JSON.parse(
      written(ctx).find((edit) => edit.path.endsWith('gt.config.json'))
        ?.content ?? '{}'
    ) as { dictionary?: string };

    // The engine half: the emitted config names the migrated catalog, which is
    // what `gt generate`/`gt translate` read (aggregateInlineTranslations).
    expect(config.dictionary).toBe('./messages/en.json');
    expect(ctx.recordedDictionary).toEqual({
      path: './messages/en.json',
      wroteThisRun: true,
    });
    // The report half: measured on the emitted sniply tree, bare `gt generate`
    // wrote 52,826-byte catalogs, byte-identical to the run with the flag.
    expect(report).toContain('`npx gt generate` (no API key)');
    expect(report).toContain('"dictionary": "./messages/en.json"');
    expect(report).toContain('no flag is needed');
    // The three claims R4 falsified must be gone.
    expect(report).not.toContain('The flag is required');
    expect(report).not.toContain('not in gt.config.json');
    expect(report).not.toContain(
      'No inline content or dictionaries were found'
    );
  });

  it('names the flag when the config already points at another dictionary', async () => {
    const cwd = makeApp({
      'gt.config.json': JSON.stringify({ dictionary: './my/own/dict.json' }),
    });
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);
    const config = JSON.parse(
      written(ctx).find((edit) => edit.path.endsWith('gt.config.json'))
        ?.content ?? '{}'
    ) as { dictionary?: string };

    // Never clobbered, so the bare command would generate from the user's own
    // dictionary: here the flag really is needed, and the step says so.
    expect(config.dictionary).toBe('./my/own/dict.json');
    expect(report).toContain('`npx gt generate --dictionary messages/en.json`');
    expect(report).toContain('The flag is needed here');
    expect(report).toContain('./my/own/dict.json');
    expect(report).not.toContain('no flag is needed');
  });
});

describe('round 9 B3: the payload disclosure follows the tree, not this run', () => {
  it('fires for a provider that carries no messages prop', async () => {
    const cwd = makeApp({
      [LAYOUT]: bareProviderLayout,
      'src/app/[locale]/rich/page.tsx': richPage,
    });
    const { ctx } = await migrate(cwd);
    const bullet = differences(buildReport(ctx, false, false));

    // autohack and plantpal both grew by the same 1x/2x shape with no messages
    // attribute anywhere; gating on one made the disclosure adapter-specific.
    expect(bullet).toContain('Both catalogs ship in every page');
    // Measured on sniply (catalog-key occurrences per prerendered page): 1x at
    // baseline, 2x on /en and 3x on /es while the provider renders. The old
    // sentence said "roughly one extra catalog file" for both, light by ~2x on
    // every non-default-locale page.
    expect(bullet).toContain('roughly one extra catalog file worth of HTML');
    expect(bullet).toContain("both catalogs' combined size");
    // And the remedy is stated to the measurement: after the teardown /en is
    // back at its baseline size and /es keeps one extra catalog (2x), which is
    // gt-next's own serialization, not the retained provider's copy.
    expect(bullet).toContain("removes that provider's copy");
    expect(bullet).toContain('back at its pre-migration size');
    expect(bullet).toContain('keeps one extra catalog');
  });

  it('still fires on a re-run over an already-migrated partial tree', async () => {
    const cwd = makeApp({ 'src/app/[locale]/rich/page.tsx': richPage });
    const first = await migrate(cwd);
    applyEdits(first.ctx.edits);

    const second = await migrate(cwd);
    const layout = fs.readFileSync(path.join(cwd, LAYOUT), 'utf8');
    const bullet = differences(buildReport(second.ctx, false, false));

    // Nothing to rewrite this run, but the tree still carries both payloads.
    expect(layout).toContain('<NextIntlClientProvider');
    expect(
      written(second.ctx).some((edit) => edit.path.endsWith('layout.tsx'))
    ).toBe(false);
    expect(bullet).toContain('Both catalogs ship in every page');
  });

  it('says nothing about payload once no provider is left in the tree', async () => {
    const cwd = makeApp();
    const { ctx } = await migrate(cwd);

    expect(ctx.skippedFiles.size).toBe(0);
    expect(buildReport(ctx, false, false)).not.toContain(
      'Both catalogs ship in every page'
    );
  });

  it('does not count a provider mounted only by a test helper', async () => {
    // An app whose own layout never rendered a provider (a bespoke server-side
    // setup), where the only <NextIntlClientProvider> left in the tree is a unit
    // test's render helper. That provider ships in no page, so the payload
    // sentence would be false; the tree-wide scan has to skip test files.
    const cwd = makeApp({
      [LAYOUT]: lines(
        'export default async function LocaleLayout({',
        '  children,',
        '  params,',
        '}: {',
        '  children: React.ReactNode;',
        '  params: Promise<{ locale: string }>;',
        '}) {',
        '  const { locale } = await params;',
        '  return (',
        '    <html lang={locale}>',
        '      <body>{children}</body>',
        '    </html>',
        '  );',
        '}'
      ),
      'tests/render.tsx': lines(
        "import { NextIntlClientProvider } from 'next-intl';",
        'export function renderWithIntl(ui, messages) {',
        '  return <NextIntlClientProvider messages={messages}>{ui}</NextIntlClientProvider>;',
        '}'
      ),
    });
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    // The helper is in the test stage, and the provider survives in the tree.
    expect(ctx.testFilesNeedingMigration ?? []).toContain(
      path.join(cwd, 'tests/render.tsx')
    );
    expect(
      fs.readFileSync(path.join(cwd, 'tests/render.tsx'), 'utf8')
    ).toContain('<NextIntlClientProvider');
    expect(report).not.toContain('Both catalogs ship in every page');
  });
});

describe('round 9 B2: the delete guard reads package.json "imports"', () => {
  const configFiles = {
    'src/i18n/routing.ts': lines(
      "import { defineRouting } from 'next-intl/routing';",
      "export const routing = defineRouting({ locales: ['en', 'es'], defaultLocale: 'en' });"
    ),
    'src/i18n/request.ts': lines(
      "import { getRequestConfig } from 'next-intl/server';",
      "import { routing } from './routing';",
      'export default getRequestConfig(async ({ requestLocale }) => {',
      '  const requested = await requestLocale;',
      '  return { locale: requested ?? routing.defaultLocale, messages: {} };',
      '});'
    ),
  };
  const aliasConsumer = lines(
    "import { routing } from '#config';",
    'export const locales = routing.locales;'
  );
  const packageWithImports = JSON.stringify({
    name: 'demo',
    imports: { '#config': './src/i18n/routing.ts' },
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  });

  it('keeps a file a subpath alias still points at, and names the importer', async () => {
    const cwd = makeApp({
      ...configFiles,
      'package.json': packageWithImports,
      'src/lib/locales.ts': aliasConsumer,
    });
    const { ctx } = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    // Pre-fix: both config files were deleted and src/lib/locales.ts kept a
    // dangling `#config` import (proved with a real ERR_MODULE_NOT_FOUND).
    expect(deletions(ctx)).not.toContain(path.join(cwd, 'src/i18n/routing.ts'));
    // The alias now RESOLVES, so the reason is the exact-importer one, the same
    // as when the alias is declared in tsconfig.
    expect(todoFor(ctx, cwd, 'src/i18n/routing.ts')).toContain(
      'kept because src/lib/locales.ts still imports it'
    );
    expect(report).toContain('src/lib/locales.ts');
  });

  it('still resolves the same alias through tsconfig paths (control)', async () => {
    const cwd = makeApp({
      ...configFiles,
      'package.json': packageWithImports,
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '#config': ['./src/i18n/routing.ts'] } },
      }),
      'src/lib/locales.ts': aliasConsumer,
    });
    const { ctx } = await migrate(cwd);

    expect(deletions(ctx)).not.toContain(path.join(cwd, 'src/i18n/routing.ts'));
    expect(todoFor(ctx, cwd, 'src/i18n/routing.ts')).toContain(
      'kept because src/lib/locales.ts still imports it'
    );
  });

  it('keeps the file for a bundler-only alias it cannot follow at all', async () => {
    const cwd = makeApp({
      ...configFiles,
      // Declared nowhere: a webpack resolve.alias is invisible here, and the
      // delete is the irreversible operation, so the file stays.
      'src/lib/locales.ts': aliasConsumer,
    });
    const { ctx } = await migrate(cwd);

    expect(deletions(ctx)).not.toContain(path.join(cwd, 'src/i18n/routing.ts'));
    expect(todoFor(ctx, cwd, 'src/i18n/routing.ts')).toContain(
      "imports '#config', which gt migrate could not resolve"
    );
  });

  it('does not treat prose in a comment as an unfollowable import', async () => {
    // Found while measuring B2's fix on the real sniply fixture: the specifier
    // extraction matches file TEXT, and tests/e2e/helpers/api.ts carries
    // `// Extract just the token value from "sniply_session=TOKEN; Path=/; ..."`.
    // Nothing can resolve that, so the new "an unfollowable specifier retains the
    // file" rule blocked the WHOLE teardown on a comment: next-intl stayed in
    // package.json and both config files survived on a tree that was fully
    // migrated.
    const cwd = makeApp({
      ...configFiles,
      'tests/helpers/api.ts': lines(
        '// Extract just the token value from "demo_session=TOKEN; Path=/; ..."',
        'export const token = (raw: string) => raw.split(";")[0];'
      ),
    });
    const { ctx } = await migrate(cwd);

    expect(deletions(ctx).sort()).toEqual([
      path.join(cwd, 'src/i18n/request.ts'),
      path.join(cwd, 'src/i18n/routing.ts'),
    ]);
    expect(todoFor(ctx, cwd, 'src/i18n/routing.ts')).not.toContain(
      'kept because'
    );
  });

  it('still deletes both config files when the graph is complete', async () => {
    const cwd = makeApp({
      ...configFiles,
      'src/lib/locales.ts': lines("export const locales = ['en', 'es'];"),
    });
    const { ctx } = await migrate(cwd);

    // The migration's own gt-next imports must not block this: they are a
    // package it installs, never a project path.
    expect(deletions(ctx).sort()).toEqual([
      path.join(cwd, 'src/i18n/request.ts'),
      path.join(cwd, 'src/i18n/routing.ts'),
    ]);
  });
});

describe('round 9 B5: a hoisted workspace package is a package, not a project path', () => {
  const hazardFiles = {
    'src/i18n/labels.ts': lines(
      "'use client';",
      "import { useTranslations } from 'next-intl';",
      'export function useLocalizedLabel() {',
      "  const t = useTranslations('Home');",
      '  return (value) => t(value);',
      '}'
    ),
    'src/lib/hazard.ts': lines(
      "import { useLocalizedLabel } from '@/i18n/labels';",
      'export function shout(value) {',
      '  const localize = useLocalizedLabel();',
      '  return localize(value).toUpperCase();',
      '}'
    ),
    'src/app/[locale]/a/page.tsx': lines(
      "import { shout } from '../../../lib/hazard';",
      'export default function A() {',
      "  return <p>{shout('x')}</p>;",
      '}'
    ),
    // An undeclared import whose tail collides with the hazard module's name.
    'src/lib/use-helper.ts': lines(
      "import { helper } from 'hoisted-pkg/hazard';",
      'export const value = helper();'
    ),
  };

  /** Builds <root>/packages/app with node_modules only at <root>. */
  function workspace(hoisted: string[]): string {
    const root = makeTree(
      {
        'package.json': JSON.stringify({
          name: 'monorepo',
          private: true,
          workspaces: ['packages/*'],
        }),
      },
      { prefix: 'gt-migrate-r9r4-ws-' }
    );
    const cwd = path.join(root, 'packages', 'app');
    fs.mkdirSync(cwd, { recursive: true });
    writeFiles(cwd, { ...baseFiles, ...hazardFiles });
    for (const name of hoisted) {
      const dir = path.join(root, 'node_modules', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name })
      );
    }
    return cwd;
  }

  it('resolves it from the repo root and keeps per-route containment', async () => {
    const cwd = workspace(['hoisted-pkg']);
    const { ctx } = await migrate(cwd);
    const hazard = (ctx.latentClientCallHazards ?? [])[0];

    // Pre-fix: reachSetIncomplete was set from 'hoisted-pkg/hazard', which
    // withheld getLocale.ts/getRegion.ts for the WHOLE project.
    expect(hazard?.reachSetIncomplete).toBeUndefined();
    expect(
      written(ctx).filter((edit) => /get(Locale|Region)\.ts$/.test(edit.path))
    ).toHaveLength(2);
    expect(warningText(ctx)).not.toContain('static rendering NOT restored');
    expect(
      written(ctx)
        .filter((edit) => (edit.content ?? '').includes('force-dynamic'))
        .map((edit) => path.relative(cwd, edit.path).split(path.sep).join('/'))
    ).toEqual(['src/app/[locale]/a/page.tsx']);
  });

  it('keeps withholding when the package is installed nowhere at all', async () => {
    const cwd = workspace([]);
    const { ctx } = await migrate(cwd);
    const hazard = (ctx.latentClientCallHazards ?? [])[0];

    // The conservative direction stays for a specifier that matches nothing.
    expect(hazard?.reachSetIncomplete).toBeDefined();
    expect(
      written(ctx).filter((edit) => /get(Locale|Region)\.ts$/.test(edit.path))
    ).toHaveLength(0);
    expect(warningText(ctx)).toContain('static rendering NOT restored');
  });
});

describe('round 9 B6: a teardown blocked by an unreadable file says so', () => {
  // Only meaningful for a user who cannot read the file; root always can.
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

  it.skipIf(asRoot)(
    'names the file and the reason on the retained config',
    async () => {
      const cwd = makeApp({
        'src/i18n/routing.ts': lines(
          "import { defineRouting } from 'next-intl/routing';",
          "export const routing = defineRouting({ locales: ['en', 'es'], defaultLocale: 'en' });"
        ),
        // INSIDE the source globs, so the transform's own read fails first and the
        // file becomes a skip: the whole teardown branch is then skipped, and the
        // guard's unreadable reason was never reached (R4 case 7).
        'src/lib/secret.ts': 'export const a = 1;\n',
      });
      const unreadable = path.join(cwd, 'src/lib/secret.ts');
      fs.chmodSync(unreadable, 0o000);
      try {
        const { ctx } = await migrate(cwd);
        const report = buildReport(ctx, false, false);

        expect(ctx.unreadableFiles).toEqual([unreadable]);
        expect(deletions(ctx)).toEqual([]);
        const reason = todoFor(ctx, cwd, 'src/i18n/routing.ts');
        expect(reason).toContain('could not read src/lib/secret.ts');
        expect(reason).toContain('finish the teardown');
        // And it is no longer filed as inert "retained wiring" with no reason.
        expect(report.split('## Still referencing')[1] ?? '').not.toContain(
          'src/i18n/routing.ts'
        );
      } finally {
        fs.chmodSync(unreadable, 0o644);
      }
    }
  );
});

describe('round 9 B7: computed keys are named on a next-intl run', () => {
  const computedPage = (namespace: string, key: string) =>
    lines(
      "'use client';",
      "import { useTranslations } from 'next-intl';",
      'export default function Steps({ index }) {',
      `  const t = useTranslations('${namespace}');`,
      `  return <p>{t(\`${key}\`)}</p>;`,
      '}'
    );

  it('names the site and checks the static prefix it can check', async () => {
    const cwd = makeApp({
      'src/app/[locale]/steps/page.tsx': computedPage('UI', 'step.${index}'),
    });
    const { ctx } = await migrate(cwd);
    const reason = todoFor(ctx, cwd, 'src/app/[locale]/steps/page.tsx');

    expect(reason).toContain('computed key `UI.step.${...}`');
    expect(reason).toContain(
      "Its static prefix 'UI.step' IS in messages/en.json"
    );
    expect(reason).toContain('gt-next THROWS');
    // Report-only: an unresolvable key is never counted as a measured miss.
    expect(warningText(ctx)).not.toContain(
      'converted call site(s) ask for dictionary keys'
    );
  });

  it('says plainly when the static prefix is absent', async () => {
    const cwd = makeApp({
      'src/app/[locale]/steps/page.tsx': computedPage('UI', 'phase.${index}'),
    });
    const { ctx } = await migrate(cwd);

    expect(todoFor(ctx, cwd, 'src/app/[locale]/steps/page.tsx')).toContain(
      "Its static prefix 'UI.phase' is NOT in messages/en.json, so every key this expression builds will throw"
    );
  });

  it('leaves static keys and non-lookup shapes alone', async () => {
    const cwd = makeApp({
      'src/app/[locale]/steps/page.tsx': lines(
        "'use client';",
        "import { useTranslations } from 'next-intl';",
        'export default function Steps() {',
        "  const t = useTranslations('UI');",
        "  return <p>{t('step.one')}</p>;",
        '}'
      ),
    });
    const { ctx } = await migrate(cwd);

    expect(todoFor(ctx, cwd, 'src/app/[locale]/steps/page.tsx')).not.toContain(
      'computed key'
    );
  });
});

describe('round 9 B8: the Created inventory and the pre-flight line', () => {
  const i18nextApp = {
    'package.json': JSON.stringify({
      name: 'demo',
      dependencies: {
        next: '15.5.0',
        react: '19.0.0',
        i18next: '^23.11.0',
        'react-i18next': '^14.1.0',
      },
    }),
    'locales/en/translation.json': JSON.stringify({ title: 'Welcome' }),
    'locales/es/translation.json': JSON.stringify({ title: 'Bienvenido' }),
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
  };

  const writeTree = (files: Record<string, string>) =>
    makeTree(files, { prefix: 'gt-migrate-r9r4-i18n-' });

  it('lists the catalogs it synthesized under Created', async () => {
    const cwd = writeTree(i18nextApp);
    const { ctx } = await migrate(cwd, 'react-i18next');
    const report = buildReport(ctx, false, false);
    const created = report.split('## Created')[1]?.split('\n## ')[0] ?? '';

    // These files did not exist before the run (the source catalogs stay under
    // locales/<locale>/), so the section that says exactly that has to list
    // them: pre-fix they appeared under Converted only.
    expect(created).toContain('gt/dictionaries/en.json');
    expect(created).toContain('gt/dictionaries/es.json');
  });

  it('prints both the discovery location and the output directory', async () => {
    const cwd = writeTree(i18nextApp);
    const { ctx, io } = await migrate(cwd, 'react-i18next');
    const catalogLine = io.info.find((message) =>
      message.startsWith('Found catalogs for')
    );

    expect(ctx.catalogs.sourceDir).toBe(path.join(cwd, 'locales'));
    expect(catalogLine).toContain('in locales/');
    expect(catalogLine).toContain(
      'catalog directory for the migration: gt/dictionaries/'
    );
  });

  it('names the same directory twice when the catalogs stay in place', async () => {
    const cwd = makeApp();
    const { ctx, io } = await migrate(cwd);
    const catalogLine = io.info.find((message) =>
      message.startsWith('Found catalogs for')
    );

    expect(ctx.catalogs.sourceDir).toBeUndefined();
    expect(catalogLine).toContain('in messages/');
    expect(catalogLine).toContain(
      'catalog directory for the migration: messages/'
    );
  });
});
