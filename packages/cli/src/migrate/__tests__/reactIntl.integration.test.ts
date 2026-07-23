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

const tmpDirs: string[] = [];

const PACKAGE_JSON = JSON.stringify(
  {
    name: 'demo-rintl',
    dependencies: {
      next: '15.5.0',
      react: '19.0.0',
      'react-intl': '^6.6.0',
    },
    devDependencies: {
      '@formatjs/cli': '^6.2.0',
      'babel-plugin-formatjs': '^10.5.0',
      '@formatjs/swc-plugin': '^1.7.0',
    },
  },
  null,
  2
);

const NEXT_CONFIG = [
  'const nextConfig = {',
  '  experimental: {',
  "    swcPlugins: [['@formatjs/swc-plugin', { overrideIdFn: '[sha512:contenthash:base64:6]' }]],",
  '  },',
  '};',
  'export default nextConfig;',
].join('\n');

const PROVIDER = [
  "'use client';",
  "import { IntlProvider } from 'react-intl';",
  'export function IntlProviderWrapper({',
  '  locale,',
  '  messages,',
  '  children,',
  '}: {',
  '  locale: string;',
  '  messages: Record<string, string>;',
  '  children: React.ReactNode;',
  '}) {',
  '  return (',
  '    <IntlProvider locale={locale} defaultLocale="en" messages={messages}>',
  '      {children}',
  '    </IntlProvider>',
  '  );',
  '}',
].join('\n');

const LAYOUT = [
  "import { IntlProviderWrapper } from '@/i18n/IntlProviderWrapper';",
  'export function generateStaticParams() {',
  "  return [{ locale: 'en' }, { locale: 'fr' }];",
  '}',
  'export default async function LocaleLayout({',
  '  children,',
  '  params,',
  '}: {',
  '  children: React.ReactNode;',
  '  params: Promise<{ locale: string }>;',
  '}) {',
  '  const { locale } = await params;',
  '  const messages = (await import(`../../../messages/${locale}.json`)).default;',
  '  return (',
  '    <html lang={locale}>',
  '      <body>',
  '        <IntlProviderWrapper locale={locale} messages={messages}>',
  '          {children}',
  '        </IntlProviderWrapper>',
  '      </body>',
  '    </html>',
  '  );',
  '}',
].join('\n');

const PAGE = [
  "import { createIntl } from 'react-intl';",
  'export default async function Page({',
  '  params,',
  '}: {',
  '  params: Promise<{ locale: string }>;',
  '}) {',
  '  const { locale } = await params;',
  '  const intl = createIntl({',
  '    locale,',
  '    messages: (await import(`../../../messages/${locale}.json`)).default,',
  '  });',
  '  return (',
  '    <main>',
  "      <h1>{intl.formatMessage({ id: 'title' })}</h1>",
  "      <p data-locale={locale}>{intl.formatMessage({ id: 'greeting' }, { name: 'Ada' })}</p>",
  '    </main>',
  '  );',
  '}',
].join('\n');

const CLIENT = [
  "'use client';",
  'import {',
  '  useIntl,',
  '  FormattedMessage,',
  '  FormattedNumber,',
  '  FormattedDate,',
  '  FormattedPlural,',
  '  defineMessages,',
  "} from 'react-intl';",
  'const strings = defineMessages({',
  "  cart: { id: 'cart', defaultMessage: 'Cart' },",
  '});',
  'export function Client({',
  '  count,',
  '  price,',
  '  when,',
  '}: {',
  '  count: number;',
  '  price: number;',
  '  when: Date;',
  '}) {',
  '  const intl = useIntl();',
  '  return (',
  '    <section>',
  '      <h2>{intl.formatMessage(strings.cart)}</h2>',
  '      <p><FormattedMessage id="greeting" values={{ name: \'Ada\' }} /></p>',
  '      <p><FormattedNumber value={price} style="currency" currency="USD" /></p>',
  '      <p><FormattedDate value={when} year="numeric" month="long" day="numeric" /></p>',
  '      <p><FormattedPlural value={count} one="one item" other="# items" /></p>',
  '    </section>',
  '  );',
  '}',
].join('\n');

const EN = JSON.stringify({
  title: 'Welcome to demo',
  greeting: 'Hello, {name}!',
  cart: 'Cart',
});
const FR = JSON.stringify({
  title: 'Bienvenue sur demo',
  greeting: 'Bonjour, {name}!',
  cart: 'Panier',
});
const ES = JSON.stringify({ title: 'Bienvenido a demo' });

function makeApp(overrides: Record<string, string | null> = {}): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-rintl-app-'));
  tmpDirs.push(cwd);
  const files: Record<string, string | null> = {
    'package.json': PACKAGE_JSON,
    'next.config.ts': NEXT_CONFIG,
    'src/i18n/IntlProviderWrapper.tsx': PROVIDER,
    'src/app/[locale]/layout.tsx': LAYOUT,
    'src/app/[locale]/page.tsx': PAGE,
    'src/app/[locale]/Client.tsx': CLIENT,
    'messages/en.json': EN,
    'messages/fr.json': FR,
    'messages/es.json': ES,
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const abs = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return cwd;
}

afterEach(() => {
  while (tmpDirs.length) {
    fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

const read = (cwd: string, rel: string) =>
  fs.readFileSync(path.join(cwd, rel), 'utf8');

const run = (cwd: string, opts: Record<string, unknown> = {}) =>
  handleMigrateCommand(
    {
      config: 'gt.config.json',
      from: 'react-intl',
      dryRun: false,
      yes: true,
      allowDirty: true,
      ...opts,
    },
    'react-intl',
    cwd
  );

describe('react-intl migration integration', () => {
  it('migrates a clean app end to end (full teardown)', async () => {
    const cwd = makeApp();
    await run(cwd);

    // client: useIntl -> useTranslations, dictionary calls intact, formatters
    // converted, defineMessages dropped.
    const client = read(cwd, 'src/app/[locale]/Client.tsx');
    expect(client).toMatch(
      /import \{[^}]*useTranslations[^}]*\} from ['"]gt-next['"]/
    );
    expect(client).toMatch(/const intl = useTranslations\(\)/);
    expect(client).toMatch(/intl\(['"]cart['"]\)/);
    expect(client).toMatch(/intl\(['"]greeting['"], \{ name: ['"]Ada['"] \}\)/);
    expect(client).toMatch(/<Num options=/);
    expect(client).toMatch(/<DateTime options=/);
    expect(client).toMatch(/<Plural[^>]*n=\{count\}/);
    expect(client).not.toContain('react-intl');
    expect(client).not.toContain('defineMessages');
    expect(client).not.toContain('FormattedMessage');

    // page (RSC): createIntl -> await getTranslations()
    const page = read(cwd, 'src/app/[locale]/page.tsx');
    expect(page).toMatch(/const intl = await getTranslations\(\)/);
    expect(page).toMatch(
      /import \{ getTranslations \} from ['"]gt-next\/server['"]/
    );
    expect(page).toMatch(/intl\(['"]title['"]\)/);
    expect(page).not.toContain('react-intl');

    // provider wrapper: the <IntlProvider> element and its import are gone
    // (the component name IntlProviderWrapper legitimately survives).
    const provider = read(cwd, 'src/i18n/IntlProviderWrapper.tsx');
    expect(provider).not.toMatch(/<IntlProvider[\s>]/);
    expect(provider).not.toContain('react-intl');
    expect(provider).toMatch(/<>[\s\S]*\{children\}[\s\S]*<\/>/);

    // layout: GTProvider inserted, static lang preserved
    const layout = read(cwd, 'src/app/[locale]/layout.tsx');
    expect(layout).toContain('<GTProvider>');
    expect(layout).toContain('lang={locale}');
    expect(layout).toMatch(/import \{ GTProvider \} from ['"]gt-next['"]/);

    // config: withGTConfig wraps, FormatJS swc-plugin torn down
    const config = read(cwd, 'next.config.ts');
    expect(config).toContain('withGTConfig');
    expect(config).not.toContain('@formatjs/swc-plugin');

    // scaffolding
    const gtConfig = JSON.parse(read(cwd, 'gt.config.json'));
    expect(gtConfig.defaultLocale).toBe('en');
    expect(gtConfig.locales.sort()).toEqual(['en', 'es', 'fr']);
    expect(read(cwd, 'src/loadDictionary.ts')).toContain(
      '../messages/${locale}.json'
    );
    expect(read(cwd, 'src/getLocale.ts')).toContain(
      "import { locale } from 'next/root-params'"
    );

    // teardown: react-intl and the FormatJS toolchain removed from package.json
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['react-intl']).toBeUndefined();
    expect(pkg.devDependencies['@formatjs/cli']).toBeUndefined();
    expect(pkg.devDependencies['babel-plugin-formatjs']).toBeUndefined();
    expect(pkg.devDependencies['@formatjs/swc-plugin']).toBeUndefined();

    // report: no skips, unknown-key behavior difference documented
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).not.toContain('## Needs manual migration');
    expect(report).toMatch(/Unknown dictionary keys throw in gt-next/);
    expect(report).toContain('react-intl');
  });

  it('performs a partial migration when an unsupported API is present', async () => {
    const cwd = makeApp({
      'src/app/[locale]/Legacy.tsx': [
        "'use client';",
        "import React from 'react';",
        "import { injectIntl } from 'react-intl';",
        'class LegacyComponent extends React.Component<any> {',
        '  render() {',
        "    return <span>{this.props.intl.formatMessage({ id: 'title' })}</span>;",
        '  }',
        '}',
        'export default injectIntl(LegacyComponent);',
      ].join('\n'),
      'src/app/[locale]/Lists.tsx': [
        "'use client';",
        "import { FormattedList } from 'react-intl';",
        'export function Lists({ items }: { items: string[] }) {',
        '  return <FormattedList value={items} type="conjunction" />;',
        '}',
      ].join('\n'),
    });
    await run(cwd);

    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('## Needs manual migration');
    expect(report).toMatch(/Legacy\.tsx/);
    expect(report).toMatch(/Lists\.tsx/);
    expect(report).toMatch(/injectIntl/);
    expect(report).toMatch(/FormattedList/);

    // partial: react-intl retained, provider retained, plugin kept
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['react-intl']).toBe('^6.6.0');
    expect(read(cwd, 'src/i18n/IntlProviderWrapper.tsx')).toContain(
      'IntlProvider'
    );
    expect(read(cwd, 'next.config.ts')).toContain('@formatjs/swc-plugin');

    // the convertible client file still migrated to gt-next
    expect(read(cwd, 'src/app/[locale]/Client.tsx')).toMatch(
      /const intl = useTranslations\(\)/
    );
  });

  it('synthesizes a default-locale catalog for case b2 (no en.json)', async () => {
    const cwd = makeApp({
      // no default (en) catalog; english lives in inline defaultMessage.
      'messages/en.json': null,
      'messages/es.json': null,
      'messages/fr.json': JSON.stringify({
        title: 'Bienvenue sur demo',
        greeting: 'Bonjour, {name}!',
      }),
      'src/app/[locale]/Client.tsx': [
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        'export function Client() {',
        '  const intl = useIntl();',
        '  return (',
        '    <section>',
        "      <h1>{intl.formatMessage({ id: 'title', defaultMessage: 'Welcome to demo' })}</h1>",
        '      <p><FormattedMessage id="greeting" defaultMessage="Hello, {name}!" values={{ name: \'Ada\' }} /></p>',
        '    </section>',
        '  );',
        '}',
      ].join('\n'),
      'src/app/[locale]/page.tsx': null,
    });
    await run(cwd);

    // the missing default catalog was synthesized from harvested defaultMessages.
    const en = JSON.parse(read(cwd, 'messages/en.json'));
    expect(en.title).toBe('Welcome to demo');
    expect(en.greeting).toBe('Hello, {name}!');
    // fr translations untouched.
    expect(JSON.parse(read(cwd, 'messages/fr.json')).title).toBe(
      'Bienvenue sur demo'
    );

    const gtConfig = JSON.parse(read(cwd, 'gt.config.json'));
    expect(gtConfig.defaultLocale).toBe('en');
    expect(gtConfig.locales.sort()).toEqual(['en', 'fr']);

    // client converted without a skip (source entries exist post-harvest).
    const client = read(cwd, 'src/app/[locale]/Client.tsx');
    expect(client).toMatch(/intl\(['"]title['"]\)/);
    expect(read(cwd, 'gt-migrate-report.md')).not.toContain(
      '## Needs manual migration'
    );
  });

  it('skips rich text with a report entry (inline <T> conversion is a follow-up)', async () => {
    const cwd = makeApp({
      'src/app/[locale]/Client.tsx': [
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function Client() {',
        '  return (',
        '    <p>',
        '      <FormattedMessage id="terms" values={{ b: (chunks) => <b>{chunks}</b> }} />',
        '    </p>',
        '  );',
        '}',
      ].join('\n'),
      'messages/en.json': JSON.stringify({
        title: 'Welcome to demo',
        greeting: 'Hello, {name}!',
        cart: 'Cart',
        terms: 'Accept the <b>terms</b>',
      }),
    });
    await run(cwd);

    // The rich site is skipped whole, never converted or half-rewritten.
    const client = read(cwd, 'src/app/[locale]/Client.tsx');
    expect(client).toContain('FormattedMessage');
    expect(client).not.toMatch(/<T>/);

    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('## Needs manual migration');
    expect(report).toMatch(/rich-text tags/);
  });

  it('re-nests dotted catalog keys end to end so runtime resolution works (B1)', async () => {
    const cwd = makeApp({
      'messages/en.json': JSON.stringify({
        'Home.title': 'Welcome to demo',
        'Home.greeting': 'Hello, {name}!',
        cart: 'Cart',
      }),
      'messages/fr.json': JSON.stringify({
        'Home.title': 'Bienvenue',
        'Home.greeting': 'Bonjour, {name}!',
        cart: 'Panier',
      }),
      'messages/es.json': null,
      'src/app/[locale]/page.tsx': null,
      'src/app/[locale]/Client.tsx': [
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function Client() {',
        '  const intl = useIntl();',
        "  return <h1>{intl.formatMessage({ id: 'Home.title' })}</h1>;",
        '}',
      ].join('\n'),
    });
    await run(cwd);

    // dotted keys are re-nested into a new gt-owned dir; originals untouched.
    const nested = JSON.parse(read(cwd, 'messages-gt/en.json'));
    expect(nested.Home.title).toBe('Welcome to demo');
    // the original flat file is left as-is.
    expect(JSON.parse(read(cwd, 'messages/en.json'))['Home.title']).toBe(
      'Welcome to demo'
    );
    // loadDictionary points at the re-nested files.
    expect(read(cwd, 'src/loadDictionary.ts')).toContain('messages-gt');
    // the client converted (its emitted id resolves against the nested catalog).
    const client = read(cwd, 'src/app/[locale]/Client.tsx');
    expect(client).toMatch(/intl\(['"]Home\.title['"]\)/);
    expect(read(cwd, 'gt-migrate-report.md')).not.toContain(
      '## Needs manual migration'
    );
  });

  it('reports the webpack-build version caveat and a build step in Next steps (M5, m3)', async () => {
    const cwd = makeApp();
    await run(cwd);
    const report = read(cwd, 'gt-migrate-report.md');
    // version caveat present with the Turbopack workaround for older gt-next.
    expect(report).toMatch(/gt-next >= 11\.1\.0/);
    expect(report).toMatch(/next build --turbopack/);
    // clean migration has no TODOs section, so the step must not reference it.
    expect(report).not.toContain('## TODOs');
    expect(report).toContain('Run your build.');
    expect(report).not.toContain('Review the TODOs above');
  });

  it('warns once (top level) about FormatJS auto-generated ids and skips those files (M3)', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': null,
      'src/app/[locale]/Client.tsx': [
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function Client() {',
        // FormatJS auto-id workflow: defaultMessage, no literal id.
        '  return <p><FormattedMessage defaultMessage="Hello" /></p>;',
        '}',
      ].join('\n'),
    });
    await run(cwd);
    const report = read(cwd, 'gt-migrate-report.md');
    expect(report).toContain('## Warnings');
    expect(report).toMatch(/auto-generated ids/i);
    // the misleading "dynamic descriptor/id" diagnostic is gone.
    expect(report).toMatch(/no literal id/i);
    expect(report).not.toMatch(/dynamic descriptor/);
    // react-intl stays installed (the UI file was skipped).
    const pkg = JSON.parse(read(cwd, 'package.json'));
    expect(pkg.dependencies['react-intl']).toBe('^6.6.0');
  });

  it('does not crash on a <FormattedMessage> in a return position (B2)', async () => {
    const cwd = makeApp({
      'src/app/[locale]/page.tsx': null,
      'src/app/[locale]/Client.tsx': [
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function Title() {',
        '  return <FormattedMessage id="title" />;',
        '}',
      ].join('\n'),
    });
    // Would previously throw a raw TypeError through the whole command.
    await expect(run(cwd)).resolves.toBeUndefined();
    const client = read(cwd, 'src/app/[locale]/Client.tsx');
    expect(client).not.toContain('FormattedMessage');
    expect(client).toMatch(/\$gtT\(['"]title['"]\)|useTranslations/);
  });

  it('rejects an unsupported --from with a clean error listing sources', async () => {
    const cwd = makeApp();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);
    await expect(
      handleMigrateCommand(
        {
          config: 'gt.config.json',
          dryRun: false,
          yes: true,
          allowDirty: true,
          from: 'vue-i18n',
        },
        'react-intl',
        cwd
      )
    ).rejects.toThrow();
    exit.mockRestore();
    // nothing written
    expect(fs.existsSync(path.join(cwd, 'gt.config.json'))).toBe(false);
  });
});
