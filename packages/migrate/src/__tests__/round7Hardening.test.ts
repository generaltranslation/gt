import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectLocaleAwareNavUsage,
  transformNavigationFile,
} from '../transforms/transformNavigation.js';
import { transformSourceFile } from '../transforms/transformSource.js';
import { transformReactI18nextSource } from '../transforms/transformReactI18nextSource.js';
import { transformNextConfigFile } from '../transforms/transformNextConfig.js';
import { transformReactI18nextNextConfig } from '../transforms/transformReactI18nextNextConfig.js';
import { detectLatentClientCallHazards } from '../pipeline/latentClientCalls.js';
import { checkServerProviderBoundary } from '../pipeline/runMigration.js';
import { buildReport } from '../report/report.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import { reactIntlAdapter } from '../adapters/reactIntl.js';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';
import type { SourceAdapter } from '../adapters/types.js';

// Round-7 field-test hardening (Ernest, 2026-07-23): every test here pins a
// fix for a failure class observed on the real-app fixture matrix. The
// failure names in comments reference that review.

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(
  adapter: SourceAdapter,
  messages: Record<string, unknown> = {},
  cwd = '/project'
): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: messages, es: {} },
    dir: path.join(cwd, 'messages'),
  };
  return {
    cwd,
    catalogs,
    routing,
    adapter,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
  };
}

const lines = (...l: string[]) => l.join('\n');

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

function makeTree(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-migrate-r7-'));
  tmpDirs.push(cwd);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return cwd;
}

// ---------------------------------------------------------------------------
// P1: locale-aware navigation signatures (PlantPal/Sniply no-op selectors,
// AutoHack /en/[object Object] redirect)
// ---------------------------------------------------------------------------

describe('detectLocaleAwareNavUsage', () => {
  it('flags router.replace(href, { locale }) from a wrapper import', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import { usePathname, useRouter } from '@/i18n/navigation';",
        'export function Switcher() {',
        '  const pathname = usePathname();',
        '  const router = useRouter();',
        "  return <button onClick={() => router.replace(pathname, { locale: 'es' })} />;",
        '}'
      )
    );
    expect(reason).toMatch(/router\.replace\(href, \{ locale \}\)/);
  });

  it('flags redirect({ href, locale }) object signatures', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import { redirect } from './navigation';",
        'export function go(locale: string) {',
        "  redirect({ href: '/dash', locale });",
        '}'
      )
    );
    expect(reason).toMatch(/\[object Object\]/);
  });

  it('flags object hrefs passed to router methods', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import { useRouter } from '@/i18n/navigation';",
        'export function Go() {',
        '  const router = useRouter();',
        "  return <button onClick={() => router.push({ pathname: '/x' })} />;",
        '}'
      )
    );
    expect(reason).toMatch(/object hrefs are next-intl-only/);
  });

  it('leaves plain string navigation alone', () => {
    expect(
      detectLocaleAwareNavUsage(
        lines(
          "import { useRouter } from '@/i18n/navigation';",
          'export function Go() {',
          '  const router = useRouter();',
          "  return <button onClick={() => router.push('/about')} />;",
          '}'
        )
      )
    ).toBeNull();
  });

  it('never flags next/navigation imports (a pre-existing app bug, not ours)', () => {
    expect(
      detectLocaleAwareNavUsage(
        lines(
          "import { useRouter } from 'next/navigation';",
          'export function Go() {',
          '  const router = useRouter();',
          "  return <button onClick={() => router.replace('/x', { locale: 'es' })} />;",
          '}'
        )
      )
    ).toBeNull();
  });

  it('ignores type-only imports', () => {
    expect(
      detectLocaleAwareNavUsage(
        lines(
          "import type { useRouter } from '@/i18n/navigation';",
          'export const x = 1;'
        )
      )
    ).toBeNull();
  });
});

describe('navigation wrapper hold while locale-aware callers exist', () => {
  const canonical = lines(
    "import { createNavigation } from 'next-intl/navigation';",
    "import { routing } from './routing';",
    'export const { Link, redirect, usePathname, useRouter } =',
    '  createNavigation(routing);'
  );

  it('holds the wrapper on next-intl and names the callers', () => {
    const ctx = makeContext(nextIntlAdapter);
    ctx.localeAwareNavCallers = ['/project/components/LocaleSwitcher.tsx'];
    const result = transformNavigationFile(
      '/project/src/i18n/navigation.ts',
      canonical,
      ctx
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.join(' ')).toMatch(
      /locale-aware signatures \(components\/LocaleSwitcher\.tsx\)/
    );
  });

  it('converts normally when no caller uses locale-aware signatures', () => {
    const ctx = makeContext(nextIntlAdapter);
    const result = transformNavigationFile(
      '/project/src/i18n/navigation.ts',
      canonical,
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('gt-next/link');
  });

  it('keeps the plain Link re-export in JS wrappers (no TS cast available)', () => {
    const ctx = makeContext(nextIntlAdapter);
    const result = transformNavigationFile(
      '/project/src/i18n/navigation.js',
      canonical,
      ctx
    );
    expect(result.code).toContain(
      "export { default as Link } from 'gt-next/link';"
    );
  });
});

// ---------------------------------------------------------------------------
// P1: react-intl IntlShape bindings must be fully consumable
// (PlantPal .locale reads, Sniply intl.locale, cross-file formatMessage)
// ---------------------------------------------------------------------------

describe('react-intl binding-reference audit', () => {
  const messages = { a: 'A' };
  const transform = (code: string) =>
    transformSourceFile(
      'src/app/[locale]/Client.tsx',
      code,
      makeContext(reactIntlAdapter, messages)
    );

  it('skips when intl.locale is read as a value', () => {
    const r = transform(
      lines(
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        '  const lang = intl.locale;',
        "  return <span lang={lang}>{intl.formatMessage({ id: 'a' })}</span>;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(
      /intl\.locale .* no 'locale' member/
    );
  });

  it('skips when the intl object escapes as a value (cross-file IntlShape)', () => {
    const r = transform(
      lines(
        "import { useIntl } from 'react-intl';",
        "import { helper } from './helper';",
        'export function C() {',
        '  const intl = useIntl();',
        '  return <span>{helper(intl)}</span>;',
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/is not an IntlShape/);
  });

  it('skips when a destructured formatMessage escapes as a value', () => {
    const r = transform(
      lines(
        "import { useIntl } from 'react-intl';",
        "import { helper } from './helper';",
        'export function C() {',
        '  const { formatMessage } = useIntl();',
        '  return <span>{helper(formatMessage)}</span>;',
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(
      /call signature changes under gt-next/
    );
  });

  it('still converts pure formatMessage-call usage', () => {
    const r = transform(
      lines(
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <span>{intl.formatMessage({ id: 'a' })}</span>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useTranslations()');
  });
});

describe('react-intl async Server Components get the server API', () => {
  const messages = { a: 'A' };
  const transform = (code: string) =>
    transformSourceFile(
      'src/app/[locale]/page.tsx',
      code,
      makeContext(reactIntlAdapter, messages)
    );

  it('converts useIntl in an async component to await getTranslations()', () => {
    const r = transform(
      lines(
        "import { useIntl } from 'react-intl';",
        'export default async function Page() {',
        '  const intl = useIntl();',
        "  return <h1>{intl.formatMessage({ id: 'a' })}</h1>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('await getTranslations()');
    expect(r.code).toMatch(/from ["']gt-next\/server["']/);
    expect(r.code).not.toContain('useTranslations()');
  });

  it('injects await getTranslations() for <FormattedMessage> in async components', () => {
    const r = transform(
      lines(
        "import { FormattedMessage } from 'react-intl';",
        'export default async function Page() {',
        '  return (',
        '    <h1>',
        '      <FormattedMessage id="a" />',
        '    </h1>',
        '  );',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('await getTranslations()');
    expect(r.code).toMatch(/from ["']gt-next\/server["']/);
  });
});

// ---------------------------------------------------------------------------
// P1: react-i18next escaped translation functions (Memo Engine's 134
// translateKnown(t, ...) TFunction errors, PlantPal's branded-type failure)
// ---------------------------------------------------------------------------

describe('react-i18next t-escape audit', () => {
  const messages = { title: 'Title' };
  const transform = (code: string) =>
    transformReactI18nextSource(
      'src/app/page.tsx',
      code,
      makeContext(reactI18nextAdapter, messages)
    );

  it('skips when t is passed to a helper as a value', () => {
    const r = transform(
      lines(
        "import { useTranslation } from 'react-i18next';",
        "import { translateKnown } from '@/lib/i18n-known';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <span>{translateKnown(t, 'title')}</span>;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/TFunction/);
  });

  it('allows the t={t} prop on <Trans> (the Trans conversion consumes it)', () => {
    const r = transform(
      lines(
        "import { Trans, useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return <Trans t={t} i18nKey="title" />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    // structure, not quote style (raw generator output double-quotes)
    expect(r.code!.replace(/"/g, "'")).toContain("t('title')");
  });
});

// ---------------------------------------------------------------------------
// P1: unrecognized Next config shapes (Memo Engine's composed async function
// export; every locale route 500'd with converted consumers and no withGTConfig)
// ---------------------------------------------------------------------------

describe('next-intl config function-shape fallback', () => {
  const memoShape = lines(
    "import type { NextConfig } from 'next';",
    "import createNextIntlPlugin from 'next-intl/plugin';",
    "import { withWorkflow } from 'workflow/next';",
    '',
    "const withNextIntl = createNextIntlPlugin('./i18n/request.ts');",
    'const config: NextConfig = { poweredByHeader: false };',
    '',
    'export default async function nextConfig(',
    '  phase: string,',
    '  ctx: { defaultConfig: NextConfig },',
    '): Promise<NextConfig> {',
    '  let composed: NextConfig | typeof nextConfig = config;',
    '  for (const configModifier of [withNextIntl, withWorkflow]) {',
    '    composed = configModifier(composed);',
    "    if (typeof composed === 'function') {",
    '      composed = await composed(phase, ctx);',
    '    }',
    '  }',
    '  return composed;',
    '}'
  );

  it('wraps the whole function export and keeps the plugin composed inside', () => {
    const ctx = makeContext(nextIntlAdapter);
    const result = transformNextConfigFile(
      '/project/next.config.ts',
      memoShape,
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('export default withGTConfig(nextConfig');
    // the function body (and the plugin inside it) survives untouched
    expect(result.code).toContain('createNextIntlPlugin');
    expect(result.code).toMatch(
      /import createNextIntlPlugin from ["']next-intl\/plugin["']/
    );
    expect(ctx.nextConfigRetainsPlugin).toBe(true);
    expect(result.todos.map((todo) => todo.reason).join(' ')).toMatch(
      /stays composed inside/
    );
  });
});

describe('react-i18next config hardening', () => {
  it('wraps a named function declaration export', () => {
    const ctx = makeContext(reactI18nextAdapter);
    const result = transformReactI18nextNextConfig(
      '/project/next.config.ts',
      lines(
        'export default async function config() {',
        '  return { poweredByHeader: false };',
        '}'
      ),
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('async function config()');
    expect(result.code).toContain('export default withGTConfig(config');
  });

  it('skips (not a TODO) when no export can be wrapped, so the driver can stop', () => {
    const ctx = makeContext(reactI18nextAdapter);
    const result = transformReactI18nextNextConfig(
      '/project/next.config.ts',
      'export const partial = { poweredByHeader: false };',
      ctx
    );
    expect(result.code).toBeNull();
    expect(result.skipReasons.length).toBeGreaterThan(0);
    expect(result.todos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1: latent client-call hazards (Sniply's /about, /terms, /privacy prerender
// crashes: server files calling useLocalizedLabel() from a client module)
// ---------------------------------------------------------------------------

describe('detectLatentClientCallHazards', () => {
  function contextFor(files: Record<string, string>): MigrationContext {
    const cwd = makeTree(files);
    const ctx = makeContext(nextIntlAdapter, {}, cwd);
    ctx.projectFiles = Object.keys(files).map((file) => path.join(cwd, file));
    return ctx;
  }

  it('flags a server file calling a client-module function', () => {
    const ctx = contextFor({
      'src/i18n/labels.ts': lines(
        "'use client';",
        'export function useLocalizedLabel() {',
        '  return (value: string) => value;',
        '}'
      ),
      'src/app/about/page.tsx': lines(
        "import { useLocalizedLabel } from '@/i18n/labels';",
        'export default function AboutPage() {',
        '  const localize = useLocalizedLabel();',
        "  return <h1>{localize('About')}</h1>;",
        '}'
      ),
    });
    detectLatentClientCallHazards(ctx);
    expect(ctx.latentClientCallHazards).toHaveLength(1);
    expect(ctx.latentClientCallHazards![0].importedName).toBe(
      'useLocalizedLabel'
    );
  });

  it('does not flag rendering a client COMPONENT from a server file', () => {
    const ctx = contextFor({
      'src/components/Thing.tsx': lines(
        "'use client';",
        'export function Thing() {',
        '  return <span />;',
        '}'
      ),
      'src/app/page.tsx': lines(
        "import { Thing } from '../components/Thing';",
        'export default function Page() {',
        '  return <Thing />;',
        '}'
      ),
    });
    detectLatentClientCallHazards(ctx);
    expect(ctx.latentClientCallHazards).toBeUndefined();
  });

  it('ignores test files (not routes; prerender never runs them)', () => {
    const ctx = contextFor({
      'src/i18n/labels.ts': lines(
        "'use client';",
        'export function useLocalizedLabel() {',
        '  return (value: string) => value;',
        '}'
      ),
      'tests/labels.test.ts': lines(
        "import { useLocalizedLabel } from '../src/i18n/labels';",
        'it("works", () => { useLocalizedLabel(); });'
      ),
    });
    detectLatentClientCallHazards(ctx);
    expect(ctx.latentClientCallHazards).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// P1: server provider boundary pre-flight (AutoHack's client root layout
// production dictionary crash; Memo/Sniply custom locale bridges)
// ---------------------------------------------------------------------------

describe('checkServerProviderBoundary', () => {
  function boundaryFor(files: Record<string, string>) {
    const cwd = makeTree({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: { next: '15.5.0' },
      }),
      ...files,
    });
    const ctx = makeContext(reactI18nextAdapter, {}, cwd);
    ctx.projectFiles = Object.keys(files).map((file) => path.join(cwd, file));
    return checkServerProviderBoundary(ctx);
  }

  const clientRootLayout = lines(
    "'use client';",
    'export default function RootLayout({ children }: { children: React.ReactNode }) {',
    '  return (',
    '    <html>',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}'
  );
  const serverBodyLayout = clientRootLayout.replace("'use client';\n", '');
  const passthroughLayout = lines(
    'export default function LocaleLayout({ children }: { children: React.ReactNode }) {',
    '  return children;',
    '}'
  );

  it('fails a client-component <body> layout (the AutoHack prod crash shape)', () => {
    const problem = boundaryFor({
      'src/app/layout.tsx': clientRootLayout,
      'src/app/[locale]/layout.tsx': passthroughLayout,
    });
    expect(problem?.why).toMatch(/Client Component/);
  });

  it('fails a separate root layout above [locale] (locale unresolvable per-route)', () => {
    const problem = boundaryFor({
      'src/app/layout.tsx': serverBodyLayout,
      'src/app/[locale]/layout.tsx': passthroughLayout,
    });
    expect(problem?.why).toMatch(/root layout sits above/);
  });

  it('fails when there is no [locale] segment at all', () => {
    const problem = boundaryFor({
      'src/app/layout.tsx': serverBodyLayout,
    });
    expect(problem?.why).toMatch(/no \[locale\] route segment/);
  });

  it('passes the [locale]-as-root server layout shape (the passing fixtures)', () => {
    const problem = boundaryFor({
      'src/app/[locale]/layout.tsx': serverBodyLayout,
    });
    expect(problem).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P2: tests are an explicit manual stage in the report
// ---------------------------------------------------------------------------

describe('report: tests need manual migration section', () => {
  it('lists test files in their own section, not among generic skips', () => {
    const ctx = makeContext(nextIntlAdapter);
    ctx.skippedFiles.set('/project/tests/setup.ts', [
      'test file uses next-intl; migrate the test setup, render helpers, and mocks by hand (see the report\'s "Tests need manual migration" section)',
    ]);
    ctx.testFilesNeedingMigration = ['/project/tests/setup.ts'];
    const report = buildReport(ctx, false);
    expect(report).toContain('## Tests need manual migration');
    expect(report).toContain('suites WILL fail');
    // listed exactly once (in its own section, not the generic skip list)
    expect(report.match(/tests\/setup\.ts/g)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Re-attack round (adversary panel on the round-7 diff): scope resolution,
// dependency arrays, and the nav-detection caller shapes the first pass missed
// ---------------------------------------------------------------------------

describe('re-attack: react-i18next scope-aware t handling', () => {
  const messages = { title: 'Title', About: { x: 'X' } };
  const transform = (code: string) =>
    transformReactI18nextSource(
      'src/app/page.tsx',
      code,
      makeContext(reactI18nextAdapter, messages)
    );

  it('converts a file whose only non-call t is a shadowing map param (the false hold)', () => {
    const r = transform(
      lines(
        "import { useTranslation } from 'react-i18next';",
        'export function About({ tools }: { tools: { name: string }[] }) {',
        '  const { t } = useTranslation();',
        '  return (',
        '    <div>',
        "      <h1>{t('title')}</h1>",
        '      {tools.map((t, i) => (',
        '        <span key={i}>{t.name}</span>',
        '      ))}',
        '    </div>',
        '  );',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useTranslations');
    // the shadow's member read is untouched
    expect(r.code).toContain('t.name');
  });

  it('does not remap a shadowing string param used in calls', () => {
    const r = transform(
      lines(
        "import { useTranslation } from 'react-i18next';",
        'function lookup(value: string) { return value; }',
        'export function Form() {',
        '  const { t } = useTranslation();',
        '  function onText(t: string) {',
        '    return lookup(t);',
        '  }',
        "  return <span data-x={onText('a')}>{t('title')}</span>;",
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    // the shadow passed to lookup() survives as-is
    expect(r.code).toContain('lookup(t)');
  });

  it('still holds a real value escape of the translation function', () => {
    const r = transform(
      lines(
        "import { useTranslation } from 'react-i18next';",
        "import { localizedError } from '@/lib/errors';",
        'export function Form() {',
        '  const { t } = useTranslation();',
        "  return <span>{localizedError('x', t)}</span>;",
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/TFunction/);
  });

  it('allows t in a hook dependency array', () => {
    const r = transform(
      lines(
        "import { useMemo } from 'react';",
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  const label = useMemo(() => t('title'), [t]);",
        '  return <span>{label}</span>;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useTranslations');
  });
});

describe('re-attack: react-intl dependency-array exemption', () => {
  const transform = (code: string) =>
    transformSourceFile(
      'src/app/[locale]/Client.tsx',
      code,
      makeContext(reactIntlAdapter, { a: 'A' })
    );

  it('allows intl in a hook dependency array', () => {
    const r = transform(
      lines(
        "import { useMemo } from 'react';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  const label = useMemo(() => intl.formatMessage({ id: 'a' }), [intl]);",
        '  return <span>{label}</span>;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useTranslations()');
  });

  it('allows a destructured formatMessage in a dependency array', () => {
    const r = transform(
      lines(
        "import { useCallback } from 'react';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const { formatMessage } = useIntl();',
        "  const label = useCallback(() => formatMessage({ id: 'a' }), [formatMessage]);",
        '  return <span>{label()}</span>;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toContain('useTranslations()');
  });
});

describe('re-attack: nav caller shapes the first pass missed', () => {
  it('flags a destructured router method called bare', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import { useRouter } from '@/i18n/navigation';",
        'export function Switcher({ pathname }: { pathname: string }) {',
        '  const { replace } = useRouter();',
        "  return <button onClick={() => replace(pathname, { locale: 'es' })} />;",
        '}'
      )
    );
    expect(reason).toMatch(/locale-aware signature/);
  });

  it('flags a chained useRouter().replace call', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import { useRouter } from '@/i18n/navigation';",
        'export function go(pathname: string) {',
        "  useRouter().replace(pathname, { locale: 'es' });",
        '}'
      )
    );
    expect(reason).toMatch(/locale-aware signature/);
  });

  it('flags namespace-imported navigation', () => {
    const reason = detectLocaleAwareNavUsage(
      lines(
        "import * as nav from '@/i18n/navigation';",
        'export function go(locale: string) {',
        "  nav.redirect({ href: '/dash', locale });",
        '}'
      )
    );
    expect(reason).toMatch(/\[object Object\]/);
  });
});
