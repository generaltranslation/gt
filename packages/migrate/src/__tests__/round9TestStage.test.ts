import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { runMigration } from '../pipeline/runMigration.js';
import { makeIO } from './support/io.js';
import {
  makeTree as makeProjectTree,
  registerTreeCleanup,
} from './support/tree.js';
import type { MigrationContext } from '../pipeline/types.js';

// Round-9 field-test hardening (Ernest, 2026-07-24): the test-file manual
// stage existed but could not SEE the files that matter. Sniply's whole i18n
// test wiring is one vi.mock("next-intl") in a project-root tests/setup.ts:
// the outside-scan pass is the only pass that reaches a root tests/ tree, and
// it gated on an import-shaped regex, so 24 broken tests were reported
// nowhere (the report never said the word "test"). Memo Engine hit the other
// half: the report named the shared render helper while the two suites that
// actually failed went unmentioned.
//
// Every test here drives the REAL pipeline over a REAL tmpdir project. The
// hole shipped past ~514 unit tests because the only test for this stage
// hand-populated ctx.testFilesNeedingMigration and asserted on the renderer
// (round7Hardening.test.ts:604), hard-coding the exact path the pipeline could
// not detect. A pre-populated context cannot fail this way, so none is used.

registerTreeCleanup();

const makeTree = (files: Record<string, string>) =>
  makeProjectTree(files, { prefix: 'gt-migrate-r9-' });

function migrate(cwd: string, from: string): Promise<MigrationContext> {
  return runMigration(
    {
      config: 'gt.config.json',
      from,
      dryRun: false,
      yes: true,
      allowDirty: true,
    },
    from,
    makeIO(),
    cwd
  );
}

const lines = (...l: string[]) => l.join('\n');

/** Relative paths of the flagged test files, POSIX, for order-free asserts. */
function flagged(ctx: MigrationContext): string[] {
  return (ctx.testFilesNeedingMigration ?? []).map((file) =>
    path.relative(ctx.cwd, file).split(path.sep).join('/')
  );
}

function skipped(ctx: MigrationContext): string[] {
  return [...ctx.skippedFiles.keys()].map((file) =>
    path.relative(ctx.cwd, file).split(path.sep).join('/')
  );
}

/** An App Router root layout with a real <body> mount point for GTProvider. */
const serverLayout = lines(
  'export default function RootLayout({',
  '  children,',
  '}: {',
  '  children: React.ReactNode;',
  '}) {',
  '  return (',
  '    <html lang="en">',
  '      <body>{children}</body>',
  '    </html>',
  '  );',
  '}'
);

/** A converted consumer: after the run it calls gt-next, not next-intl. */
const widget = lines(
  "import { useTranslations } from 'next-intl';",
  'export function Widget() {',
  "  const t = useTranslations('Home');",
  "  return <span>{t('title')}</span>;",
  '}'
);

/**
 * The baseline next-intl app every case below starts from: catalogs, a
 * [locale] root layout, a page, and one component whose hook import the
 * migration converts. Each test adds only the test files under study.
 */
const nextIntlApp = {
  'package.json': JSON.stringify({
    name: 'demo',
    dependencies: { next: '15.5.0', 'next-intl': '^4.1.0', react: '19.0.0' },
  }),
  'messages/en.json': JSON.stringify({ Home: { title: 'Welcome' } }),
  'messages/es.json': JSON.stringify({ Home: { title: 'Bienvenido' } }),
  'app/[locale]/layout.tsx': serverLayout,
  'app/[locale]/page.tsx': lines(
    "import { useTranslations } from 'next-intl';",
    'export default function Page() {',
    "  const t = useTranslations('Home');",
    "  return <h1>{t('title')}</h1>;",
    '}'
  ),
  'components/Widget.tsx': widget,
};

/** Sniply's shape: the entire i18n test wiring is one bare module specifier. */
const mockOnlySetup = lines(
  "import { vi } from 'vitest';",
  'vi.mock("next-intl", () => ({',
  '  useTranslations: () => (key: string) => key,',
  "  useLocale: () => 'en',",
  '}));'
);

describe('round 9: mock-only test wiring outside the scan is detected', () => {
  it('flags a project-root tests/setup.ts whose only next-intl reference is vi.mock()', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'tests/setup.ts': mockOnlySetup,
    });

    const ctx = await migrate(cwd, 'next-intl');

    // Detection: the pipeline itself found it (no hand-populated context).
    expect(flagged(ctx)).toContain('tests/setup.ts');
    // The premise holds: the component under test now calls gt-next, so the
    // mock is dead rather than wrong.
    const widgetEdit = ctx.edits.find((edit) =>
      edit.path.endsWith(path.join('components', 'Widget.tsx'))
    );
    expect(widgetEdit?.content).toMatch(/from ["']gt-next["']/);
    // The test file itself is never rewritten.
    expect(
      ctx.edits.some((edit) =>
        edit.path.endsWith(path.join('tests', 'setup.ts'))
      )
    ).toBe(false);

    const report = buildReport(ctx, false, false);
    expect(report).toContain('## Tests need manual migration');
    expect(report).toContain('- tests/setup.ts');
    // Per-file evidence names the edit this file needs (C3a).
    expect(report).toContain(
      'mocks next-intl (vi.mock/jest.mock); the mock no longer intercepts converted components'
    );
    // The run-level warning fires too: a failing suite must not be
    // discoverable only by running it.
    expect(ctx.warnings?.join('\n')).toMatch(
      /test file\(s\) depend on next-intl test wiring/
    );
  });

  it('still tears next-intl down: a dead mock string retains nothing', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'tests/setup.ts': mockOnlySetup,
    });

    const ctx = await migrate(cwd, 'next-intl');

    // The file is reported, but it is NOT a skip: skippedFiles is what holds
    // provider retention (runMigration/transformLayout) and the whole
    // package/config teardown (emitGtFiles' fullyMigrated) back. A test file
    // that only names next-intl inside a mock factory needs none of that
    // retained, and letting it block teardown would keep next-intl installed,
    // its plugin composed, and NextIntlClientProvider nested inside GTProvider
    // for an app with zero runtime next-intl usage.
    expect(flagged(ctx)).toContain('tests/setup.ts');
    expect(skipped(ctx)).toEqual([]);
    const pkgEdit = ctx.edits.find((edit) =>
      edit.path.endsWith('package.json')
    );
    expect(pkgEdit).toBeDefined();
    expect(pkgEdit!.content).not.toContain('next-intl');
  });

  it('keeps the teardown blocked when a test file really imports next-intl', async () => {
    // The other side of the split: a real import resolves at test time, so the
    // package must survive. Same project, one line different.
    const cwd = makeTree({
      ...nextIntlApp,
      'tests/setup.ts': lines(
        "import { NextIntlClientProvider } from 'next-intl';",
        'export const Provider = NextIntlClientProvider;'
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(flagged(ctx)).toContain('tests/setup.ts');
    expect(skipped(ctx)).toContain('tests/setup.ts');
    const pkgEdit = ctx.edits.find((edit) =>
      edit.path.endsWith('package.json')
    );
    // Partial mode: either no package.json edit at all, or one that keeps the
    // dependency.
    if (pkgEdit) expect(pkgEdit.content).toContain('next-intl');
    const report = buildReport(ctx, false, false);
    expect(report).toContain('imports next-intl directly');
  });

  it('flags a root jest.setup.js whose only reference is jest.mock()', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'jest.setup.js': lines(
        'jest.mock("next-intl", () => ({',
        '  useTranslations: () => (key) => key,',
        '}));'
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(flagged(ctx)).toContain('jest.setup.js');
    const report = buildReport(ctx, false, false);
    expect(report).toContain('- jest.setup.js');
    expect(report).toContain('mocks next-intl (vi.mock/jest.mock)');
    // Same teardown split as vi.mock: nothing retained for a dead mock.
    expect(skipped(ctx)).toEqual([]);
  });
});

describe('round 9: transitive test closure names the failing suites', () => {
  it('names the suite that imports a flagged render helper, not just the helper', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      // Memo Engine's shape: the helper wires the old provider...
      'tests/i18n-test-utils.tsx': lines(
        "import { NextIntlClientProvider } from 'next-intl';",
        "import { render } from '@testing-library/react';",
        'export function renderWithIntl(ui: React.ReactNode) {',
        '  return render(',
        '    <NextIntlClientProvider locale="en" messages={{}}>{ui}</NextIntlClientProvider>',
        '  );',
        '}'
      ),
      // ...and THIS is the suite that fails, with no next-intl reference of
      // its own. Alias specifier, so the resolution has to be alias-aware.
      'components/widget.test.tsx': lines(
        "import { renderWithIntl } from '@/tests/i18n-test-utils';",
        "import { Widget } from './Widget';",
        "it('renders', () => { renderWithIntl(<Widget />); });"
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(flagged(ctx)).toEqual(
      expect.arrayContaining([
        'tests/i18n-test-utils.tsx',
        'components/widget.test.tsx',
      ])
    );
    // The closure is report-only: the suite mentions next-intl nowhere, so
    // nothing about it needs retaining. Only the helper (a real import) is a
    // skip.
    expect(skipped(ctx)).toContain('tests/i18n-test-utils.tsx');
    expect(skipped(ctx)).not.toContain('components/widget.test.tsx');

    const report = buildReport(ctx, false, false);
    expect(report).toContain('- tests/i18n-test-utils.tsx');
    expect(report).toContain('- components/widget.test.tsx');
    expect(report).toContain('imports next-intl directly');
    expect(report).toContain('imports a test file listed here');
    // The suite is named once, not double-reported as a generic skip.
    expect(report.match(/- components\/widget\.test\.tsx/g)?.length).toBe(1);
  });

  it('closes a chain of helpers, not just direct importers', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'tests/intl-wrapper.tsx': lines(
        "import { NextIntlClientProvider } from 'next-intl';",
        'export const Wrapper = NextIntlClientProvider;'
      ),
      // one hop from the flagged file...
      'tests/render.tsx': lines(
        "import { Wrapper } from './intl-wrapper';",
        'export function renderWithIntl(ui: React.ReactNode) {',
        '  return <Wrapper locale="en" messages={{}}>{ui}</Wrapper>;',
        '}'
      ),
      // ...and two hops, which a single non-iterated pass would miss.
      'components/widget.test.tsx': lines(
        "import { renderWithIntl } from '@/tests/render';",
        "import { Widget } from './Widget';",
        "it('renders', () => { renderWithIntl(<Widget />); });"
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(flagged(ctx)).toEqual(
      expect.arrayContaining([
        'tests/intl-wrapper.tsx',
        'tests/render.tsx',
        'components/widget.test.tsx',
      ])
    );
  });

  it('does not drag in an unrelated suite that imports no flagged file', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'components/Stars.tsx': lines(
        'export function Stars({ n }: { n: number }) {',
        '  return <span>{n}</span>;',
        '}'
      ),
      'tests/setup.ts': mockOnlySetup,
      // Sniply's Stars.test.tsx: calls no translation hook, touches no i18n
      // wiring, and keeps passing after the migration. Naming it would be a
      // false claim about the user's suite.
      'components/stars.test.tsx': lines(
        "import { Stars } from './Stars';",
        "it('renders', () => { Stars({ n: 3 }); });"
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(flagged(ctx)).toEqual(['tests/setup.ts']);
    const report = buildReport(ctx, false, false);
    expect(report).not.toContain('stars.test.tsx');
  });
});

describe('round 9: the report states the manual step accurately', () => {
  it('carries the server-only collection-failure recipe for next-intl', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'tests/setup.ts': mockOnlySetup,
    });

    const report = buildReport(await migrate(cwd, 'next-intl'), false, false);

    // Mode A of the round-9 finding: the stale next-intl/server mock stops
    // intercepting, vitest loads gt-next/server for real, and server-only is
    // unresolvable there. It drops the SUITE at collection, so the tests
    // vanish from the count instead of failing (memo-engine: 9 tests).
    expect(report).toContain('must mock `gt-next/server`');
    expect(report).toContain("Cannot find package 'server-only'");
    expect(report).toContain('drops the whole suite at collection');
    // The heading no longer asserts a blanket failure for every flagged file
    // (a mock of a module whose consumers were all held still intercepts), but
    // the stakes stay in the body.
    expect(report).not.toContain(
      '## Tests need manual migration (suites WILL fail until then)'
    );
    expect(report).toContain('WILL fail');
  });

  it('omits the section entirely when no test file wires the library', async () => {
    const cwd = makeTree({
      ...nextIntlApp,
      'components/widget.test.tsx': lines(
        "import { Widget } from './Widget';",
        "it('renders', () => { Widget(); });"
      ),
    });

    const ctx = await migrate(cwd, 'next-intl');

    expect(ctx.testFilesNeedingMigration ?? []).toEqual([]);
    const report = buildReport(ctx, false, false);
    expect(report).not.toContain('Tests need manual migration');
    expect(ctx.warnings?.join('\n') ?? '').not.toMatch(/test file\(s\)/);
  });
});

// C1 routes through adapter.mentionedIn, which all three adapters implement,
// so all three are pinned: a react-intl or react-i18next app with the same
// mock-only setup file must be reported the same way.
describe('round 9: the mock-only fallback covers every adapter', () => {
  const serverLayout = lines(
    'export default function RootLayout({',
    '  children,',
    '}: {',
    '  children: React.ReactNode;',
    '}) {',
    '  return (',
    '    <html lang="en">',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}'
  );

  it('flags a react-intl mock-only setup file', async () => {
    const cwd = makeTree({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          react: '19.0.0',
          'react-intl': '^6.6.0',
        },
      }),
      'messages/en.json': JSON.stringify({ title: 'Welcome' }),
      'messages/es.json': JSON.stringify({ title: 'Bienvenido' }),
      'app/[locale]/layout.tsx': serverLayout,
      'app/[locale]/page.tsx': lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export default function Page() {',
        '  const intl = useIntl();',
        "  return <h1>{intl.formatMessage({ id: 'title' })}</h1>;",
        '}'
      ),
      'tests/setup.ts': lines(
        "import { vi } from 'vitest';",
        'vi.mock("react-intl", () => ({',
        '  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),',
        '}));'
      ),
    });

    const ctx = await migrate(cwd, 'react-intl');

    expect(flagged(ctx)).toContain('tests/setup.ts');
    const report = buildReport(ctx, false, false);
    expect(report).toContain('- tests/setup.ts');
    expect(report).toContain('mocks react-intl (vi.mock/jest.mock)');
  });

  it('flags a react-i18next mock-only setup file', async () => {
    const cwd = makeTree({
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
      'app/[locale]/layout.tsx': serverLayout,
      'app/[locale]/page.tsx': lines(
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export default function Page() {',
        '  const { t } = useTranslation();',
        "  return <h1>{t('title')}</h1>;",
        '}'
      ),
      'tests/setup.ts': lines(
        "import { vi } from 'vitest';",
        'vi.mock("react-i18next", () => ({',
        '  useTranslation: () => ({ t: (key: string) => key }),',
        '}));'
      ),
    });

    const ctx = await migrate(cwd, 'react-i18next');

    expect(flagged(ctx)).toContain('tests/setup.ts');
    const report = buildReport(ctx, false, false);
    expect(report).toContain('- tests/setup.ts');
    expect(report).toContain('mocks react-i18next (vi.mock/jest.mock)');
  });
});
