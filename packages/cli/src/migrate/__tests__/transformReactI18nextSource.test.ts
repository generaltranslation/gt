import { beforeEach, describe, expect, it } from 'vitest';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import { clearI18nextConfigCache } from '../reactI18nextConfig.js';
import { transformReactI18nextSource } from '../transformReactI18nextSource.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';

const routing: RoutingInfo = {
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

// A cwd with no i18next config file → the parser returns defaults
// (defaultNS 'translation', default separators), which is what these unit tests
// exercise. clearI18nextConfigCache() keeps the memo from leaking between tests.
function makeContext(messages: Record<string, unknown> = {}): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en'],
    byLocale: { en: messages },
    dir: '/project/gt/dictionaries',
  };
  return {
    cwd: '/no-such-project',
    catalogs,
    routing,
    adapter: reactI18nextAdapter,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
  };
}

// Raw @babel/generator output double-quotes newly created nodes; the real
// migration formats the written files afterwards (oxfmt → single quotes). These
// unit tests assert structure, not quote style, so normalize before matching.
function transform(
  code: string,
  messages: Record<string, unknown> = {},
  options: { retainProvider?: boolean } = {}
) {
  const result = transformReactI18nextSource(
    'src/app/page.tsx',
    code,
    makeContext(messages),
    options
  );
  return {
    ...result,
    code: result.code === null ? null : result.code.replace(/"/g, "'"),
  };
}

beforeEach(() => clearI18nextConfigCache());

describe('useTranslation hook swap', () => {
  it('rewrites default-namespace useTranslation to a root useTranslations', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain("import { useTranslations } from 'gt-next'");
    // gt-next's useTranslations returns the t function directly, so the
    // destructure collapses to a plain binding.
    expect(code).toContain('const t = useTranslations()');
    expect(code).toContain("t('title')");
    expect(code).not.toContain('react-i18next');
  });

  it('maps a namespaced hook to a scoped useTranslations(ns)', () => {
    const { code } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        "  const { t } = useTranslation('dashboard');",
        "  return <p>{t('widgets.count')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toContain("useTranslations('dashboard')");
    expect(code).toContain("t('widgets.count')");
  });

  it('remaps a ns:key on a root hook to a dotted dictionary path', () => {
    const { code } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('common:brand')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toContain("t('common.brand')");
  });

  it('skips a scoped hook that reads another namespace via ns:key', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        "  const { t } = useTranslation('dashboard');",
        "  return <p>{t('common:brand')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/scoped useTranslation/);
  });
});

describe('locale switching', () => {
  it('rewrites i18n.changeLanguage to useSetLocale()', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function Switch() {',
        '  const { i18n } = useTranslation();',
        "  return <button onClick={() => i18n.changeLanguage('es')}>ES</button>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain("import { useSetLocale } from 'gt-next'");
    expect(code).toContain('const i18n = useSetLocale()');
    expect(code).toContain("i18n('es')");
    expect(code).not.toContain('changeLanguage');
  });

  it('emits both hooks when t and i18n are both destructured', () => {
    const { code } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t, i18n } = useTranslation();',
        "  return <button onClick={() => i18n.changeLanguage('es')}>{t('go')}</button>;",
        '}',
      ].join('\n')
    );
    expect(code).toContain('useTranslations()');
    expect(code).toContain('useSetLocale()');
  });

  it('skips when the i18n instance is used beyond changeLanguage', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { i18n } = useTranslation();',
        '  return <p>{i18n.language}</p>;',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/beyond changeLanguage/);
  });
});

describe('<Trans> handling', () => {
  it('converts a trivial <Trans i18nKey> to a t() call', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation, Trans } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return <p><Trans i18nKey="welcome" /></p>;',
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain("t('welcome')");
    expect(code).not.toContain('<Trans');
  });

  it('skips a <Trans> with element children (points at <T>)', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation, Trans } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return <Trans i18nKey="welcome">Hello <b>world</b></Trans>;',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/element children/);
    expect(skipReasons.join(' ')).toMatch(/<T>/);
  });

  it('skips a <Trans> with a components prop', () => {
    const { skipReasons } = transform(
      [
        "import { useTranslation, Trans } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return <Trans i18nKey="k" components={{ b: <b /> }} />;',
        '}',
      ].join('\n')
    );
    expect(skipReasons.length).toBeGreaterThan(0);
  });

  it('carries count/values onto the converted t() call', () => {
    const { code } = transform(
      [
        "import { useTranslation, Trans } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return <p><Trans i18nKey="items" count={n} /></p>;',
        '}',
      ].join('\n')
    );
    expect(code).toContain("t('items', {");
    expect(code).toContain('count: n');
  });
});

describe('unsupported / bespoke inputs', () => {
  it('skips a file importing i18next directly with a server recipe', () => {
    const { code, skipReasons } = transform(
      [
        "import i18next from 'i18next';",
        "import { getT } from './i18n';",
        'export async function page() {',
        '  const { t } = await getT();',
        "  return t('h1');",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/i18next/);
    expect(skipReasons.join(' ')).toMatch(/getTranslations|gt-next\/server/);
  });

  it('skips an unsupported react-i18next API (withTranslation)', () => {
    const { code, skipReasons } = transform(
      [
        "import { withTranslation } from 'react-i18next';",
        'function C() { return null; }',
        'export default withTranslation()(C);',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/withTranslation/);
  });

  it('skips when the ready flag is destructured', () => {
    const { skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t, ready } = useTranslation();',
        "  return ready ? t('x') : null;",
        '}',
      ].join('\n')
    );
    expect(skipReasons.join(' ')).toMatch(/ready/);
  });

  it('returns unchanged for a file that never imports react-i18next', () => {
    const { code, skipReasons } = transform('export const x = 1;');
    expect(code).toBeNull();
    expect(skipReasons).toEqual([]);
  });
});

describe('t() call normalization', () => {
  it('drops an inline string defaultValue and records a todo', () => {
    const { code, todos } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('greeting', 'Hello there')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toContain("t('greeting')");
    expect(code).not.toContain('Hello there');
    expect(todos.some((todo) => /defaultValue/.test(todo.reason))).toBe(true);
  });

  it('resolves a key fallback array to the first present key', () => {
    const { code, todos } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t(['missing', 'present'])}</p>;",
        '}',
      ].join('\n'),
      { present: 'here' }
    );
    expect(code).toContain("t('present')");
    expect(todos.some((todo) => /fallback array/.test(todo.reason))).toBe(true);
  });
});

describe('provider swap', () => {
  it('rewrites <I18nextProvider> to <GTProvider> by default', () => {
    const { code } = transform(
      [
        "import { I18nextProvider } from 'react-i18next';",
        'export function Providers({ children }) {',
        '  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;',
        '}',
      ].join('\n')
    );
    expect(code).toContain('<GTProvider>');
    expect(code).toContain('</GTProvider>');
    expect(code).toContain("import { GTProvider } from 'gt-next'");
    expect(code).not.toContain('I18nextProvider');
  });

  it('retains <I18nextProvider> when retainProvider is set (partial migration)', () => {
    const { code } = transform(
      [
        "import { I18nextProvider } from 'react-i18next';",
        'export function Providers({ children }) {',
        '  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;',
        '}',
      ].join('\n'),
      {},
      { retainProvider: true }
    );
    expect(code === null || code.includes('I18nextProvider')).toBe(true);
  });
});
