import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMessage } from '@generaltranslation/format';
import { parse as parseIcu } from '@formatjs/icu-messageformat-parser';
import { handleMigrateCommand } from '../../cli/commands/migrate.js';
import { logger } from '../../console/logger.js';
import { clearI18nextConfigCache } from '@generaltranslation/migrate';

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

const tmpDirs: string[] = [];
const read = (cwd: string, rel: string) =>
  fs.readFileSync(path.join(cwd, rel), 'utf8');
const readJson = (cwd: string, rel: string) => JSON.parse(read(cwd, rel));

const PL = {
  items_one: '{{count}} produkt',
  items_few: '{{count}} produkty',
  items_many: '{{count}} produktów',
  items_other: '{{count}} produktu',
};
const AR = {
  items_zero: 'لا عناصر',
  items_one: 'عنصر واحد',
  items_two: 'عنصران',
  items_few: '{{count}} عناصر',
  items_many: '{{count}} عنصرا',
  items_other: '{{count}} عنصر',
};

function makeApp(overrides: Record<string, string> = {}): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-app-'));
  tmpDirs.push(cwd);
  const files: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          react: '19.0.0',
          i18next: '^23.0.0',
          'react-i18next': '^14.0.0',
        },
      },
      null,
      2
    ),
    'next.config.ts': [
      'const nextConfig = { reactStrictMode: true };',
      'export default nextConfig;',
    ].join('\n'),
    'app/i18n/settings.ts': [
      'export function getOptions() {',
      '  return {',
      "    supportedLngs: ['en', 'pl', 'ar'],",
      "    fallbackLng: 'en',",
      "    defaultNS: 'common',",
      "    ns: ['common', 'dashboard'],",
      '  };',
      '}',
    ].join('\n'),
    'app/[locale]/layout.tsx': [
      'export default function LocaleLayout({',
      '  children,',
      '  params,',
      '}: {',
      '  children: React.ReactNode;',
      '  params: { locale: string };',
      '}) {',
      '  return (',
      '    <html lang={params.locale}>',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
    ].join('\n'),
    'app/[locale]/page.tsx': [
      "'use client';",
      "import { useTranslation, Trans } from 'react-i18next';",
      'export default function Home() {',
      '  const { t } = useTranslation();',
      '  return (',
      '    <main>',
      "      <h1>{t('title')}</h1>",
      "      <p>{t('greeting', { name: 'Ada' })}</p>",
      "      <p>{t('items', { count: 3 })}</p>",
      '      <p><Trans i18nKey="welcome" /></p>',
      '    </main>',
      '  );',
      '}',
    ].join('\n'),
    'app/[locale]/about/page.tsx': [
      "import i18next from 'i18next';",
      "import { getT } from '../../i18n/server';",
      'export default async function About() {',
      '  const { t } = await getT();',
      "  return <p>{t('title')}</p>;",
      '}',
    ].join('\n'),
    'components/RichText.tsx': [
      "'use client';",
      "import { useTranslation, Trans } from 'react-i18next';",
      'export function RichText() {',
      '  const { t } = useTranslation();',
      '  return <Trans i18nKey="terms">I accept the <b>terms</b></Trans>;',
      '}',
    ].join('\n'),
    'public/locales/en/common.json': JSON.stringify({
      title: 'Home',
      greeting: 'Hello {{name}}',
      welcome: 'Welcome',
      items_one: '{{count}} item',
      items_other: '{{count}} items',
      price: '{{amount, currency(USD)}}',
      hostile: "set {{k}} to '{literal}'",
    }),
    'public/locales/pl/common.json': JSON.stringify({
      title: 'Strona',
      greeting: 'Cześć {{name}}',
      welcome: 'Witaj',
      ...PL,
    }),
    'public/locales/ar/common.json': JSON.stringify({
      title: 'الرئيسية',
      greeting: 'مرحبا {{name}}',
      welcome: 'أهلا',
      ...AR,
    }),
    'public/locales/en/dashboard.json': JSON.stringify({
      widgets: { count: 'Widgets' },
    }),
    'public/locales/pl/dashboard.json': JSON.stringify({
      widgets: { count: 'Widżety' },
    }),
    'public/locales/ar/dashboard.json': JSON.stringify({
      widgets: { count: 'الأدوات' },
    }),
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

/** Writes only the given files (no defaults) into a fresh temp dir. */
function makeRawApp(files: Record<string, string>): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-ri18n-raw-'));
  tmpDirs.push(cwd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

const PKG = JSON.stringify({
  name: 'demo',
  dependencies: {
    next: '15.5.0',
    react: '19.0.0',
    i18next: '^23.0.0',
    'react-i18next': '^14.0.0',
  },
});

const SETTINGS = [
  'export function getOptions() {',
  '  return {',
  "    supportedLngs: ['en', 'pl'],",
  "    fallbackLng: 'en',",
  "    defaultNS: 'translation',",
  '  };',
  '}',
].join('\n');

const OPTIONS = {
  config: 'gt.config.json',
  from: 'react-i18next',
  dryRun: false,
  yes: true,
  allowDirty: true,
} as const;

beforeEach(() => clearI18nextConfigCache());
afterEach(() => {
  vi.restoreAllMocks();
  while (tmpDirs.length)
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('react-i18next full migration', () => {
  it('converts catalogs, swaps the client surface, and reports the rest', async () => {
    const cwd = makeApp();
    await handleMigrateCommand({ ...OPTIONS }, 'i18next', cwd);

    // 1. Converted ICU dictionaries in a NEW dir; originals untouched.
    const en = readJson(cwd, 'gt/dictionaries/en.json');
    expect(en.title).toBe('Home');
    expect(en.greeting).toBe('Hello {name}');
    expect(en.items).toBe(
      '{count, plural, one {{count} item} other {{count} items}}'
    );
    expect(en.price).toBe('{amount, number, ::currency/USD}');
    expect(en.dashboard).toEqual({ widgets: { count: 'Widgets' } });
    expect(() => parseIcu(en.hostile)).not.toThrow();
    // Originals are never mutated.
    expect(readJson(cwd, 'public/locales/en/common.json').items_one).toBe(
      '{{count}} item'
    );

    // 2. Per-locale CLDR category sets.
    const pl = readJson(cwd, 'gt/dictionaries/pl.json');
    expect(pl.items).toContain('one {');
    expect(pl.items).toContain('few {');
    expect(pl.items).toContain('many {');
    expect(
      formatMessage(pl.items, { locales: ['pl'], variables: { count: 5 } })
    ).toBe('5 produktów');
    const ar = readJson(cwd, 'gt/dictionaries/ar.json');
    expect(ar.items.startsWith('{count, plural, zero {')).toBe(true);
    expect(
      formatMessage(ar.items, { locales: ['ar'], variables: { count: 2 } })
    ).toBe('عنصران');

    // 3. Loader + config point at the new dir.
    const loader = read(cwd, 'loadDictionary.ts');
    expect(loader).toMatch(/gt\/dictionaries/);
    const gtConfig = readJson(cwd, 'gt.config.json');
    expect(gtConfig.defaultLocale).toBe('en');
    expect(gtConfig.locales.sort()).toEqual(['ar', 'en', 'pl']);

    // 4. next.config wrapped with withGTConfig.
    const nextConfig = read(cwd, 'next.config.ts');
    expect(nextConfig).toContain('withGTConfig');
    expect(nextConfig).toMatch(/from ["']gt-next\/config["']/);

    // 5. Client page migrated to gt-next.
    const page = read(cwd, 'app/[locale]/page.tsx');
    expect(page).toMatch(/from ["']gt-next["']/);
    expect(page).toContain('useTranslations()');
    expect(page).not.toContain('react-i18next');

    // 6. Layout gets a GTProvider around the body.
    const layout = read(cwd, 'app/[locale]/layout.tsx');
    expect(layout).toContain('GTProvider');

    // 7. Report: server getT + non-trivial Trans skipped with recipes.
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('app/[locale]/about/page.tsx');
    expect(report).toMatch(/getTranslations|gt-next\/server/);
    expect(report).toContain('components/RichText.tsx');
    expect(report).toMatch(/<T>/);
  });

  it('migrates a returned standalone <Trans> without crashing the run (B1)', async () => {
    const cwd = makeApp({
      'components/Banner.tsx': [
        "'use client';",
        "import { useTranslation, Trans } from 'react-i18next';",
        'export function Banner() {',
        '  const { t } = useTranslation();',
        '  return <Trans i18nKey="welcome" />;',
        '}',
      ].join('\n'),
    });
    // Before B1 this threw an uncaught babel TypeError and aborted the command.
    await handleMigrateCommand({ ...OPTIONS }, 'i18next', cwd);
    const banner = read(cwd, 'components/Banner.tsx');
    expect(banner).toMatch(/return t\(["']welcome["']\)/);
    expect(banner).not.toContain('<Trans');
    expect(banner).toMatch(/from ["']gt-next["']/);
    // The rest of the app still migrated.
    expect(fs.existsSync(path.join(cwd, 'gt/dictionaries/en.json'))).toBe(true);
  });

  it('adds the gt-next import to a combined-import provider during a partial migration (G1)', async () => {
    // A single declaration imports both useTranslation and I18nextProvider.
    // Another file uses an unsupported react-i18next API and is skipped, which
    // makes the run a partial migration (retainProvider). The provider file must
    // keep <I18nextProvider> AND still gain the gt-next import for its migrated
    // useTranslations() hook; the retained-import branch used to skip it.
    const cwd = makeApp({
      'app/[locale]/Providers.tsx': [
        "'use client';",
        "import { useTranslation, I18nextProvider } from 'react-i18next';",
        "import i18n from '../../i18n';",
        'export function Providers({ children }: { children: React.ReactNode }) {',
        '  const { t } = useTranslation();',
        '  return (',
        '    <I18nextProvider i18n={i18n}>',
        "      <h1>{t('title')}</h1>",
        '      {children}',
        '    </I18nextProvider>',
        '  );',
        '}',
      ].join('\n'),
      // Unsupported API → this file is skipped → partial migration.
      'components/Legacy.tsx': [
        "'use client';",
        "import { useSSR } from 'react-i18next';",
        'export function Legacy() {',
        '  useSSR({}, {});',
        '  return null;',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand({ ...OPTIONS }, 'i18next', cwd);

    const providers = read(cwd, 'app/[locale]/Providers.tsx');
    // The migrated hook has its import and call...
    expect(providers).toMatch(
      /import \{ useTranslations \} from ['"]gt-next['"]/
    );
    expect(providers).toContain('useTranslations()');
    // ...and the provider (plus its react-i18next import) is retained.
    expect(providers).toContain('<I18nextProvider');
    expect(providers).toMatch(
      /import \{ I18nextProvider \} from ['"]react-i18next['"]/
    );
    // The skip that forced the partial migration is reported.
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('components/Legacy.tsx');
  });

  it('honors --from react-i18next explicitly', async () => {
    const cwd = makeApp();
    await handleMigrateCommand(
      { ...OPTIONS, from: 'react-i18next' },
      'base',
      cwd
    );
    expect(fs.existsSync(path.join(cwd, 'gt/dictionaries/en.json'))).toBe(true);
  });

  it('refuses a next-i18next project with the scoped message', async () => {
    const cwd = makeApp({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          'next-i18next': '^15.0.0',
          'react-i18next': '^14.0.0',
          i18next: '^23.0.0',
        },
      }),
    });
    const errors: string[] = [];
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`exit:${code}`);
    }) as never);
    // logErrorAndExit routes through the logger; capture stderr-ish output.
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args.join(' '));
      });

    await expect(
      handleMigrateCommand({ ...OPTIONS, from: 'i18next' }, 'i18next', cwd)
    ).rejects.toThrow('exit:1');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
    // Nothing was written.
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'gt/dictionaries'))).toBe(false);
  });

  it('warns loudly about a [lng] segment that renders the wrong language (F1)', async () => {
    const cwd = makeRawApp({
      'package.json': PKG,
      'next.config.ts': 'export default {};',
      'app/i18n/settings.ts': SETTINGS,
      'app/[lng]/layout.tsx': [
        'export default function L({ children, params }: any) {',
        '  return <html lang={params.lng}><body>{children}</body></html>;',
        '}',
      ].join('\n'),
      'app/[lng]/page.tsx': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export default function P() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('items', { count: 5 })}</p>;",
        '}',
      ].join('\n'),
      'public/locales/en/translation.json': JSON.stringify({
        items_one: '{{count}} item',
        items_other: '{{count}} items',
      }),
      'public/locales/pl/translation.json': JSON.stringify({
        items_one: '{{count}} produkt',
        items_other: '{{count}} produktów',
      }),
    });
    await handleMigrateCommand(
      { ...OPTIONS, from: 'react-i18next' },
      'base',
      cwd
    );
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('## WARNINGS');
    expect(report).toMatch(/render in the DEFAULT language/i);
    expect(report).toMatch(/WRONG LANGUAGE/);
    // The warning names the actual segment.
    expect(report).toContain('[lng]');
  });

  it('lists files that import a left-unchanged wrapper module (F2)', async () => {
    const cwd = makeRawApp({
      'package.json': PKG,
      'next.config.ts': 'export default {};',
      'app/i18n/settings.ts': SETTINGS,
      'app/i18n/client.ts': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function useT(ns?: string) {',
        '  return useTranslation(ns);',
        '}',
      ].join('\n'),
      'app/[locale]/layout.tsx': [
        'export default function L({ children }: any) {',
        '  return <html><body>{children}</body></html>;',
        '}',
      ].join('\n'),
      'app/[locale]/page.tsx': [
        "'use client';",
        "import { useT } from '../i18n/client';",
        'export default function P() {',
        '  const { t } = useT();',
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n'),
      'public/locales/en/translation.json': JSON.stringify({ title: 'Home' }),
      'public/locales/pl/translation.json': JSON.stringify({ title: 'Strona' }),
    });
    await handleMigrateCommand(
      { ...OPTIONS, from: 'react-i18next' },
      'base',
      cwd
    );
    const report = read(cwd, 'gt-migrate-report.md');
    // The wrapper itself is skipped and reported.
    expect(report).toContain('app/i18n/client.ts');
    // The consumer that imports it is surfaced as unmigrated.
    expect(report).toMatch(/Files importing a left-unchanged module/);
    expect(report).toContain('app/[locale]/page.tsx');
    // The evidence-degradation note is present.
    expect(report).toMatch(/context\/plural detection uses call sites/);
  });

  it('warns when next-intl is detected but react-i18next is also present (m2)', async () => {
    const cwd = makeRawApp({
      'package.json': JSON.stringify({
        name: 'demo',
        dependencies: {
          next: '15.5.0',
          'next-intl': '^3.0.0',
          'react-i18next': '^14.0.0',
          i18next: '^23.0.0',
        },
      }),
      // The App Router gate refuses a project with no app/ before the notice
      // can fire; both-libraries projects this notice serves are App Router.
      'app/page.tsx': 'export default function Page() { return null; }\n',
    });
    const warns: string[] = [];
    vi.spyOn(logger, 'warn').mockImplementation((m: string) => {
      warns.push(m);
    });
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // next-intl targeted via --from; it has no catalogs here so the run
    // errors out, but the react-i18next notice must fire first.
    await expect(
      handleMigrateCommand({ ...OPTIONS, from: 'next-intl' }, 'next-intl', cwd)
    ).rejects.toThrow();
    expect(
      warns.some(
        (w) => /react-i18next/.test(w) && /--from react-i18next/.test(w)
      )
    ).toBe(true);
  });

  it('does not write on a dry run', async () => {
    const cwd = makeApp();
    await handleMigrateCommand({ ...OPTIONS, dryRun: true }, 'i18next', cwd);
    expect(fs.existsSync(path.join(cwd, 'gt/dictionaries'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
    // Original catalogs still intact.
    expect(fs.existsSync(path.join(cwd, 'public/locales/en/common.json'))).toBe(
      true
    );
  });

  const PIPE_LAYOUT = [
    'export default function LocaleLayout({',
    '  children,',
    '  params,',
    '}: {',
    '  children: React.ReactNode;',
    '  params: { locale: string };',
    '}) {',
    '  return (',
    '    <html lang={params.locale}>',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}',
  ].join('\n');

  const pipeSettings = (): string =>
    [
      'export function getOptions() {',
      '  return {',
      "    supportedLngs: ['en'],",
      "    fallbackLng: 'en',",
      "    defaultNS: 'translation',",
      "    keySeparator: '|',",
      '  };',
      '}',
    ].join('\n');

  it('converts a custom keySeparator (|) project with resolvable keys', async () => {
    const cwd = makeRawApp({
      'package.json': PKG,
      'next.config.ts': [
        'const nextConfig = { reactStrictMode: true };',
        'export default nextConfig;',
      ].join('\n'),
      'app/i18n/settings.ts': pipeSettings(),
      'app/[locale]/layout.tsx': PIPE_LAYOUT,
      'app/[locale]/page.tsx': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export default function Home() {',
        '  const { t } = useTranslation();',
        "  return <h1>{t('nav|home')}</h1>;",
        '}',
      ].join('\n'),
      'public/locales/en/translation.json': JSON.stringify({
        nav: { home: 'Home' },
      }),
    });
    await handleMigrateCommand({ ...OPTIONS }, 'i18next', cwd);

    // Dictionary nests nav.home so gt-next resolves it by '.'.
    const en = readJson(cwd, 'gt/dictionaries/en.json');
    expect(en.nav.home).toBe('Home');
    // The emitted t() key is re-expressed from 'nav|home' to gt's '.' path.
    // (formatFiles is mocked in these tests, so the raw generator quote style is
    // whatever @babel/generator emits; assert quote-agnostically.)
    const page = read(cwd, 'app/[locale]/page.tsx');
    expect(page).toMatch(/t\(\s*["']nav\.home["']\s*\)/);
    expect(page).not.toContain('nav|home');
  });

  it('refuses a | project whose key segment contains a literal .', async () => {
    const cwd = makeRawApp({
      'package.json': PKG,
      'next.config.ts': [
        'const nextConfig = { reactStrictMode: true };',
        'export default nextConfig;',
      ].join('\n'),
      'app/i18n/settings.ts': pipeSettings(),
      'app/[locale]/layout.tsx': PIPE_LAYOUT,
      'app/[locale]/page.tsx': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export default function Home() {',
        '  const { t } = useTranslation();',
        "  return <h1>{t('nav|a.b')}</h1>;",
        '}',
      ].join('\n'),
      'public/locales/en/translation.json': JSON.stringify({
        nav: { 'a.b': 'Home' },
      }),
    });
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    // logErrorAndExit routes the refusal message through logger.error.
    const errors: string[] = [];
    vi.spyOn(logger, 'error').mockImplementation((m: string) => {
      errors.push(m);
    });

    await expect(
      handleMigrateCommand({ ...OPTIONS, from: 'i18next' }, 'i18next', cwd)
    ).rejects.toThrow('exit:1');
    expect(errors.join(' ')).toMatch(/mis-nest|keySeparator/);
    // Nothing was written.
    expect(fs.existsSync(path.join(cwd, 'gt/dictionaries'))).toBe(false);
  });
});

describe('react-i18next out-of-scope teardown scan (projectUsagePattern)', () => {
  // A clean client migration (page + I18nextProvider) scoped with --src, plus a
  // server file elsewhere in the project. The out-of-scope scan must key off the
  // library this adapter actually migrates (react-i18next), not bare i18next.
  const CLEAN_CLIENT_FILES: Record<string, string> = {
    'package.json': PKG,
    'next.config.ts': 'export default {};',
    'app/i18n/settings.ts': SETTINGS,
    'app/[locale]/layout.tsx': [
      'export default function L({ children }: any) {',
      '  return <html><body>{children}</body></html>;',
      '}',
    ].join('\n'),
    'app/[locale]/page.tsx': [
      "'use client';",
      "import { useTranslation } from 'react-i18next';",
      'export default function Home() {',
      '  const { t } = useTranslation();',
      "  return <h1>{t('title')}</h1>;",
      '}',
    ].join('\n'),
    'app/[locale]/Providers.tsx': [
      "'use client';",
      "import { useTranslation, I18nextProvider } from 'react-i18next';",
      "import i18n from '../../i18n';",
      'export function Providers({ children }: { children: React.ReactNode }) {',
      '  const { t } = useTranslation();',
      '  return (',
      '    <I18nextProvider i18n={i18n}>',
      "      <h1>{t('title')}</h1>",
      '      {children}',
      '    </I18nextProvider>',
      '  );',
      '}',
    ].join('\n'),
    'public/locales/en/translation.json': JSON.stringify({ title: 'Home' }),
    'public/locales/pl/translation.json': JSON.stringify({ title: 'Strona' }),
  };

  it('swaps I18nextProvider when an out-of-scope file uses bare i18next only', async () => {
    // The server file uses core i18next (not react-i18next). It is outside the
    // --src scope, so the whole-project scan sees it. Because this adapter
    // migrates the react-i18next client surface, a bare-i18next server file must
    // NOT count as an unscanned react-i18next usage; the client provider swap
    // stays a clean full migration.
    const cwd = makeRawApp({
      ...CLEAN_CLIENT_FILES,
      'server/i18n-server.ts': [
        "import i18next from 'i18next';",
        'export async function initServer() {',
        "  await i18next.init({ lng: 'en', resources: {} });",
        '  return i18next;',
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      { ...OPTIONS, from: 'react-i18next', src: ['app/**/*.{js,jsx,ts,tsx}'] },
      'react-i18next',
      cwd
    );

    const providers = read(cwd, 'app/[locale]/Providers.tsx');
    // Clean full migration: the provider is swapped for <GTProvider>.
    expect(providers).toContain('<GTProvider');
    expect(providers).not.toContain('<I18nextProvider');
    // The bare-i18next server file is not misreported as an unscanned usage.
    expect(read(cwd, 'gt-migrate-report.md')).not.toContain(
      'server/i18n-server.ts'
    );
  });

  it('retains I18nextProvider when an out-of-scope file still uses react-i18next', async () => {
    // Guard against over-tightening: a genuine react-i18next usage outside the
    // scope must still block the provider swap and be reported as unscanned.
    const cwd = makeRawApp({
      ...CLEAN_CLIENT_FILES,
      'widgets/Sidebar.tsx': [
        "'use client';",
        "import { useTranslation } from 'react-i18next';",
        'export function Sidebar() {',
        '  const { t } = useTranslation();',
        "  return <aside>{t('title')}</aside>;",
        '}',
      ].join('\n'),
    });
    await handleMigrateCommand(
      { ...OPTIONS, from: 'react-i18next', src: ['app/**/*.{js,jsx,ts,tsx}'] },
      'react-i18next',
      cwd
    );

    const providers = read(cwd, 'app/[locale]/Providers.tsx');
    // Partial migration: the provider is retained for the unscanned file.
    expect(providers).toContain('<I18nextProvider');
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('not scanned');
    expect(report).toContain('widgets/Sidebar.tsx');
  });
});
