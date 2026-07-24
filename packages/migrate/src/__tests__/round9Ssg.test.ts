import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Round 9, SSG regression class (Ernest's finding on next-intl/sniply, worker
// w4's root cause): ONE latent client-call hazard anywhere in the project
// withheld getLocale.ts/getRegion.ts project-wide, which cost Sniply all 15 of
// its SSG route patterns (30 prerendered pages -> 0), and the report claimed
// "Routes stay dynamic exactly as before the migration" about a baseline it
// never measured.
//
// Every test here drives the REAL pipeline (runMigration over files on disk in
// a tmpdir) so it pins DETECTION, not just rendering: a hand-populated
// latentClientCallHazards context is exactly how the hole shipped last round.
// ---------------------------------------------------------------------------

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

const lines = (...parts: string[]) => parts.join('\n') + '\n';

/** A [locale] root layout that migrates cleanly (the shape every fixture has). */
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

/** The 'use client' module whose hook must never be called on the server. */
const clientLabels = lines(
  "'use client';",
  "import { useTranslations } from 'next-intl';",
  'export function useLocalizedLabel() {',
  "  const t = useTranslations('Labels');",
  '  return (value: string) => t(value);',
  '}'
);

/** A client page: prerenders fine, and anything it imports is client graph. */
const clientHomePage = lines(
  "'use client';",
  "import { useTranslations } from 'next-intl';",
  'export default function Home() {',
  "  const t = useTranslations('Home');",
  "  return <h1>{t('title')}</h1>;",
  '}'
);

const baseFiles: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'messages/en.json': JSON.stringify({
    Home: { title: 'Welcome' },
    Labels: { x: 'X' },
  }),
  'messages/es.json': JSON.stringify({
    Home: { title: 'Bienvenido' },
    Labels: { x: 'X' },
  }),
  'src/app/[locale]/layout.tsx': localeLayout,
  'src/app/[locale]/page.tsx': clientHomePage,
  'src/i18n/labels.ts': clientLabels,
};

function makeApp(overrides: Record<string, string> = {}): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-r9ssg-'));
  tmpDirs.push(cwd);
  for (const [relative, content] of Object.entries({
    ...baseFiles,
    ...overrides,
  })) {
    const absolute = path.join(cwd, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
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

/** Applies the buffered edits the way the CLI does, for a real re-run test. */
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
  written(ctx).filter((edit) => (edit.content ?? '').includes('force-dynamic'));
const warningText = (ctx: MigrationContext) => (ctx.warnings ?? []).join('\n');

// The exact sentence round 9 found false (emitGtFiles.ts:511 at d46a60e63): the
// migrator never measures baseline rendering, so it can never claim this.
const FALSE_BASELINE_CLAIM =
  'Routes stay dynamic exactly as before the migration';

describe('round 9: a hazard no route can render is not a hazard', () => {
  it('ignores a hazard file nothing imports (the dead-file trigger)', async () => {
    // w4 §7: adding this one unreferenced file to a clean app destroyed all four
    // of PlantPal's SSG route patterns.
    const cwd = makeApp({
      'src/lib/deadHazard.ts': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export function neverCalled() {',
        '  return useLocalizedLabel();',
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards).toBeUndefined();
    expect(emittedResolvers(ctx)).toHaveLength(2);
    expect(forceDynamicEdits(ctx)).toEqual([]);
    const report = buildReport(ctx, false, false);
    expect(report).toContain('Static rendering preserved');
    expect(report).not.toContain('static rendering NOT restored');
    expect(report).not.toContain('deadHazard.ts; calls');
    expect(report).not.toContain('held dynamic');
  });

  it('ignores a component only client modules import (the BarberCard case)', async () => {
    // No directive of its own, so the old check called it a server module; RSC
    // renders it on the client, and Sniply's baseline prerendered it in three
    // SSG routes.
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': lines(
        "'use client';",
        "import { Card } from '@/components/Card';",
        'export default function Home() {',
        '  return <Card />;',
        '}'
      ),
      'src/components/Card.tsx': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export function Card() {',
        '  const localize = useLocalizedLabel();',
        "  return <span>{localize('x')}</span>;",
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards).toBeUndefined();
    expect(emittedResolvers(ctx)).toHaveLength(2);
    expect(forceDynamicEdits(ctx)).toEqual([]);
    expect(warningText(ctx)).not.toContain('static rendering NOT restored');
  });

  it('keeps the hazard when an unresolvable import could reach it', async () => {
    // The acquittal above is only honest while the import graph is complete.
    // A tsconfig/webpack alias gt migrate cannot resolve could be the server
    // importer it never saw, so the conservative project-wide withhold stays.
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': lines(
        "import '@lib/hidden';",
        'export default function About() {',
        '  return <h1>About</h1>;',
        '}'
      ),
      'src/lib/hidden.ts': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export function hidden() {',
        '  return useLocalizedLabel();',
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards).toHaveLength(1);
    expect(ctx.latentClientCallHazards![0].caller).toBe(
      path.join(cwd, 'src/lib/hidden.ts')
    );
    expect(ctx.latentClientCallHazards![0].reachedFrom).toEqual([]);
    expect(emittedResolvers(ctx)).toEqual([]);
    expect(warningText(ctx)).toContain('could not determine which routes');
  });
});

describe('round 9: containment holds only the routes that reach a hazard', () => {
  const hazardAbout = lines(
    "import { useLocalizedLabel } from '@/i18n/labels';",
    'export default function About() {',
    '  const localize = useLocalizedLabel();',
    "  return <h1>{localize('x')}</h1>;",
    '}'
  );

  it('emits the resolvers and holds only the hazard-reaching page dynamic', async () => {
    const cwd = makeApp({ 'src/app/[locale]/about/page.tsx': hazardAbout });
    const ctx = await migrate(cwd);

    // The resolvers are emitted, so every other route keeps static rendering.
    expect(
      emittedResolvers(ctx)
        .map((edit) => path.basename(edit.path))
        .sort()
    ).toEqual(['getLocale.ts', 'getRegion.ts']);

    // Exactly one route file is held dynamic: the one that reaches the hazard.
    const contained = forceDynamicEdits(ctx);
    expect(contained).toHaveLength(1);
    expect(contained[0].path).toBe(
      path.join(cwd, 'src/app/[locale]/about/page.tsx')
    );
    expect(contained[0].content).toContain(
      'export const dynamic = "force-dynamic";'
    );
    // The healthy [locale] page is untouched by containment.
    const home = written(ctx).find(
      (edit) => edit.path === path.join(cwd, 'src/app/[locale]/page.tsx')
    );
    expect(home?.content).not.toContain('force-dynamic');

    // The warning names the contained route, says the rest stay static, and
    // claims nothing about how the app rendered before this run.
    const warnings = warningText(ctx);
    expect(warnings).toContain('1 route(s) held dynamic');
    expect(warnings).toContain('/[locale]/about');
    expect(warnings).toContain('Every other route keeps static rendering');
    expect(warnings).not.toContain(FALSE_BASELINE_CLAIM);
    expect(warnings).not.toContain('static rendering NOT restored');

    // The report lists the contained file with its hazard chain.
    const report = buildReport(ctx, false, false);
    expect(report).toContain('held dynamic (gt migrate added');
    expect(report).toMatch(
      /Chain: src\/app\/\[locale\]\/about\/page\.tsx calls useLocalizedLabel\(\) from the client module src\/i18n\/labels\.ts/
    );
  });

  it('places the export after the imports of a page it also converted', async () => {
    // about/page.tsx here ALSO uses next-intl, so the transform already has a
    // pending write for it; the containment must fold into that content instead
    // of racing it (one of the two writes would otherwise win).
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': lines(
        "import { useTranslations } from 'next-intl';",
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export default function About() {',
        "  const t = useTranslations('Home');",
        '  const localize = useLocalizedLabel();',
        "  return <h1>{t('title')}{localize('x')}</h1>;",
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    const about = written(ctx).filter(
      (edit) => edit.path === path.join(cwd, 'src/app/[locale]/about/page.tsx')
    );
    // One edit for that path, carrying BOTH changes.
    expect(about).toHaveLength(1);
    const content = about[0].content ?? '';
    expect(content).toContain('force-dynamic');
    expect(content).not.toContain('next-intl');
    // The export sits after the import block, not above it.
    expect(content.indexOf('export const dynamic')).toBeGreaterThan(
      content.lastIndexOf('import ')
    );
  });

  it('holds a nested layout dynamic, covering its subtree', async () => {
    const cwd = makeApp({
      'src/app/[locale]/legal/layout.tsx': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export default function LegalLayout({',
        '  children,',
        '}: {',
        '  children: React.ReactNode;',
        '}) {',
        '  const localize = useLocalizedLabel();',
        "  return <section>{localize('x')}{children}</section>;",
        '}'
      ),
      'src/app/[locale]/legal/terms/page.tsx': lines(
        'export default function Terms() {',
        '  return <h1>Terms</h1>;',
        '}'
      ),
    });
    const ctx = await migrate(cwd);

    expect(emittedResolvers(ctx)).toHaveLength(2);
    const contained = forceDynamicEdits(ctx);
    expect(contained).toHaveLength(1);
    expect(contained[0].path).toBe(
      path.join(cwd, 'src/app/[locale]/legal/layout.tsx')
    );
    expect(warningText(ctx)).toContain('/[locale]/legal');
  });

  it('re-running adds no second dynamic export (idempotent containment)', async () => {
    const cwd = makeApp({ 'src/app/[locale]/about/page.tsx': hazardAbout });
    const first = await migrate(cwd);
    applyEdits(first.edits);
    const aboutPath = path.join(cwd, 'src/app/[locale]/about/page.tsx');
    expect(
      fs.readFileSync(aboutPath, 'utf8').match(/export const dynamic/g)
    ).toHaveLength(1);

    // A full first migration strips next-intl from package.json, but the
    // library is still installed until the user prunes; that is the state a
    // re-run actually happens in (the report tells them to re-run after fixing
    // the hazard).
    const installed = path.join(cwd, 'node_modules/next-intl');
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(
      path.join(installed, 'package.json'),
      JSON.stringify({ name: 'next-intl', version: '4.1.0' })
    );

    const second = await migrate(cwd);
    applyEdits(second.edits);
    const content = fs.readFileSync(aboutPath, 'utf8');
    expect(content.match(/export const dynamic/g)).toHaveLength(1);
    expect(content.match(/force-dynamic/g)).toHaveLength(1);
    // Still reported as contained, now as a pre-existing export.
    expect(buildReport(second, false, false)).toContain(
      'held dynamic (it already exports dynamic = "force-dynamic")'
    );
    // And the second run still does not withhold static rendering.
    expect(warningText(second)).not.toContain('static rendering NOT restored');
  });

  it('withholds rather than overwrite a route that sets its own dynamic mode', async () => {
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx':
        'export const dynamic = "force-static";\n' + hazardAbout,
    });
    const ctx = await migrate(cwd);

    expect(forceDynamicEdits(ctx)).toEqual([]);
    expect(emittedResolvers(ctx)).toEqual([]);
    expect(warningText(ctx)).toContain(
      'it already exports dynamic = "force-static"'
    );
  });
});

describe('round 9: withholding is honest about what it costs', () => {
  const hazardFooter = lines(
    "import { useLocalizedLabel } from '@/i18n/labels';",
    'export default function Footer() {',
    '  const localize = useLocalizedLabel();',
    "  return <footer>{localize('x')}</footer>;",
    '}'
  );

  it('withholds project-wide when the [locale] layout itself is the hazard', async () => {
    const cwd = makeApp({
      'src/app/[locale]/layout.tsx': localeLayout.replace(
        "import { NextIntlClientProvider } from 'next-intl';",
        lines(
          "import { NextIntlClientProvider } from 'next-intl';",
          "import { useLocalizedLabel } from '@/i18n/labels';"
        ).trimEnd()
      ),
      'src/app/[locale]/about/page.tsx': lines(
        'export default function About() {',
        '  return <h1>About</h1>;',
        '}'
      ),
    });
    // The hazard call lives in the layout body.
    const layoutPath = path.join(cwd, 'src/app/[locale]/layout.tsx');
    fs.writeFileSync(
      layoutPath,
      fs
        .readFileSync(layoutPath, 'utf8')
        .replace(
          '  const messages = await getMessages();',
          lines(
            '  const messages = await getMessages();',
            '  const localize = useLocalizedLabel();',
            "  void localize('x');"
          ).trimEnd()
        )
    );
    const ctx = await migrate(cwd);

    expect(ctx.skippedFiles.get(layoutPath)).toBeUndefined();
    expect(ctx.latentClientCallHazards).toHaveLength(1);
    expect(ctx.latentClientCallHazards![0].caller).toBe(layoutPath);
    // Nothing to contain: the layout's subtree is every localized route.
    expect(emittedResolvers(ctx)).toEqual([]);
    expect(forceDynamicEdits(ctx)).toEqual([]);

    const warnings = warningText(ctx);
    expect(warnings).toContain('static rendering NOT restored');
    expect(warnings).toContain(
      'a layout whose subtree is the whole localized app'
    );
    // Names the route patterns that now render dynamically.
    expect(warnings).toContain('/[locale]');
    expect(warnings).toContain('/[locale]/about');
    // States the consequence and points at the measurement it cannot make.
    expect(warnings).toContain(
      'including any route that `next build` previously'
    );
    expect(warnings).toContain('Compare the route table');
    // The false claim is gone.
    expect(warnings).not.toContain(FALSE_BASELINE_CLAIM);
    expect(buildReport(ctx, false, false)).not.toContain(FALSE_BASELINE_CLAIM);
  });

  it('withholds when a shared component reaches the hazard from the [locale] layout', async () => {
    const cwd = makeApp({
      'src/app/[locale]/layout.tsx': localeLayout
        .replace('        {children}', '        {children}\n        <Footer />')
        .replace(
          "import { NextIntlClientProvider } from 'next-intl';",
          lines(
            "import { NextIntlClientProvider } from 'next-intl';",
            "import Footer from '@/components/Footer';"
          ).trimEnd()
        ),
      'src/components/Footer.tsx': hazardFooter,
    });
    const ctx = await migrate(cwd);

    expect(ctx.latentClientCallHazards).toHaveLength(1);
    expect(emittedResolvers(ctx)).toEqual([]);
    expect(warningText(ctx)).toContain(
      'a layout whose subtree is the whole localized app'
    );
  });

  it('drops the "dynamic rendering hid it" claim from every hazard TODO', async () => {
    // w4 measured the opposite in the unmigrated baseline: /en/about, /en/terms
    // and /en/privacy already returned HTTP 500 with this exact error, so
    // dynamic rendering moved the failure, it did not hide it.
    const cwd = makeApp({
      'src/app/[locale]/about/page.tsx': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export default function About() {',
        '  const localize = useLocalizedLabel();',
        "  return <h1>{localize('x')}</h1>;",
        '}'
      ),
    });
    const ctx = await migrate(cwd);
    const report = buildReport(ctx, false, false);

    expect(report).toContain('Attempted to call useLocalizedLabel()');
    expect(report).not.toContain('dynamic rendering hid it');
    expect(report).toContain(
      'This bug predates the migration: the route already throws this at request time'
    );
    expect(report).toContain(
      'it only moved the failure from build time to request time'
    );
  });

  it('no source file claims routes stay dynamic as before the migration', () => {
    // Belt and braces on the wording itself: the sentence must not come back
    // through some other emit path.
    const root = path.resolve(import.meta.dirname, '..');
    const stack: string[] = [root];
    const offenders: string[] = [];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') stack.push(full);
          continue;
        }
        if (!/\.[cm]?tsx?$/.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes(FALSE_BASELINE_CLAIM)) {
          offenders.push(path.relative(root, full));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
