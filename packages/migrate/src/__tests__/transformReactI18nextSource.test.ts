import { parse } from '@babel/parser';
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

describe('N2: type-only react-i18next imports are build-erased, not skipped', () => {
  it('passes through a file whose only surface is `import type { … }` with no report', () => {
    const { code, skipReasons } = transform(
      [
        "import type { TFunction } from 'react-i18next';",
        'export function label(fn: TFunction) {',
        "  return fn('title');",
        '}',
      ].join('\n')
    );
    // A pure `import type` is erased at build and react-i18next is never
    // uninstalled, so nothing needs migrating: untouched, and no spurious
    // "unsupported API" skip entry.
    expect(code).toBeNull();
    expect(skipReasons).toEqual([]);
  });

  it('passes through a file whose only surface is an inline `type` specifier', () => {
    const { code, skipReasons } = transform(
      [
        "import { type TFunction } from 'react-i18next';",
        'export function label(fn: TFunction) {',
        "  return fn('title');",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons).toEqual([]);
  });

  it('ignores an inline `type` specifier and still migrates the value import beside it', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation, type TFunction } from 'react-i18next';",
        'export function label(fn: TFunction) {',
        "  return fn('title');",
        '}',
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n')
    );
    // The `type TFunction` neither triggers an unsupported-API skip nor is
    // dropped by import surgery (it would otherwise dangle): it survives as a
    // build-erased type import while useTranslation migrates.
    expect(skipReasons).toEqual([]);
    expect(code).toContain("import { useTranslations } from 'gt-next'");
    expect(code).toContain('const t = useTranslations()');
    expect(code).toContain('TFunction');
    expect(code).toContain('react-i18next');
  });

  it('leaves a standalone `import type` declaration untouched while migrating a sibling value import', () => {
    const { code, skipReasons } = transform(
      [
        "import type { TFunction } from 'react-i18next';",
        "import { useTranslation } from 'react-i18next';",
        'export function label(fn: TFunction) {',
        "  return fn('title');",
        '}',
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain("import { useTranslations } from 'gt-next'");
    expect(code).toContain('TFunction');
    expect(code).toContain('react-i18next');
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

  it('drops a positional default but preserves a trailing options object', () => {
    const { code, todos } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('items', 'fallback', { count: n })}</p>;",
        '}',
      ].join('\n')
    );
    // The default is dropped, but the third-argument options survive as the
    // gt-next t(key, options) second argument.
    const compact = (code ?? '').replace(/\s+/g, ' ');
    expect(compact).toContain("t('items', { count: n })");
    expect(code).not.toContain('fallback');
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

describe('adversary B1: standalone <Trans> in every expression position', () => {
  const positions: Array<[string, string, string]> = [
    [
      'return argument',
      'return <Trans i18nKey="welcome" />;',
      "return t('welcome')",
    ],
    [
      'variable init',
      'const el = <Trans i18nKey="welcome" />;\n  return el;',
      "const el = t('welcome')",
    ],
    [
      'ternary arm',
      'const x = cond ? <Trans i18nKey="welcome" /> : null;\n  return x;',
      "cond ? t('welcome') : null",
    ],
    [
      'arrow body',
      'const f = () => <Trans i18nKey="welcome" />;\n  return f();',
      "() => t('welcome')",
    ],
    [
      'array element',
      'const a = [<Trans i18nKey="welcome" />];\n  return a;',
      "[t('welcome')]",
    ],
  ];
  for (const [label, body, expected] of positions) {
    it(`converts a <Trans> as a ${label} to a plain call (no babel crash)`, () => {
      const { code, skipReasons } = transform(
        [
          "import { useTranslation, Trans } from 'react-i18next';",
          'export function C({ cond }) {',
          '  const { t } = useTranslation();',
          `  ${body}`,
          '}',
        ].join('\n')
      );
      expect(skipReasons).toEqual([]);
      expect(code).not.toBeNull();
      expect((code as string).replace(/\s+/g, ' ')).toContain(expected);
      expect(code).not.toContain('<Trans');
    });
  }

  it('still wraps a <Trans> JSX child in an expression container', () => {
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
    expect(code).toContain("{t('welcome')}");
  });
});

describe('adversary B2: react-i18next wrappers must skip, not miscompile', () => {
  it('skips a thin custom hook that returns useTranslation(ns)', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function useT(ns) {',
        '  return useTranslation(ns);',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/wrap|re-export/i);
  });

  it('skips a mixed file where one useTranslation reference is not converted', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function useT(ns) { return useTranslation(ns); }',
        'export function Comp() {',
        '  const { t } = useTranslation();',
        "  return <p>{t('title')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.length).toBeGreaterThan(0);
  });
});

describe('adversary M1: multi-element array namespaces', () => {
  it('skips useTranslation([a, b]) (fallback resolution)', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        "  const { t } = useTranslation(['common', 'dashboard']);",
        "  return <p>{t('welcome')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/array namespace|fallback/i);
  });

  it('skips a dynamic useTranslation namespace instead of defaulting it', () => {
    // useTranslation(nsVar) resolves at runtime; treating it as the default
    // namespace would remap every t() on this binding against the wrong
    // dictionary scope with no error.
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C({ ns }: { ns: string }) {',
        '  const { t } = useTranslation(ns);',
        "  return <p>{t('welcome')}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/namespace is not a string literal/);
  });

  it('converts a single-element array namespace', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        "  const { t } = useTranslation(['dashboard']);",
        "  return <p>{t('x')}</p>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain("useTranslations('dashboard')");
  });
});

describe('greptile: mixed static/dynamic key fallback arrays', () => {
  it('skips a t() fallback array containing a dynamic element', () => {
    // t(['key', dynamicVar]) cannot be remapped (the winning key is unknowable
    // at build time) and gt-next's t() takes a single string key, so leaving
    // the array call in the output emits code that breaks at the call site.
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C({ k }: { k: string }) {',
        '  const { t } = useTranslation();',
        "  return <p>{t(['welcome', k])}</p>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/fallback array/i);
  });
});

describe('adversary M2: bare i18n.changeLanguage references', () => {
  it('skips a bare i18n.changeLanguage reference (not a call)', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t, i18n } = useTranslation();',
        '  const changeLang = i18n.changeLanguage;',
        "  return <button onClick={() => changeLang('fr')}>{t('greeting')}</button>;",
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/changeLanguage/);
  });

  it('skips i18n.changeLanguage passed as an event handler', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { i18n } = useTranslation();',
        '  return <LangPicker onChange={i18n.changeLanguage} />;',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.join(' ')).toMatch(/changeLanguage/);
  });

  it('still converts an actual i18n.changeLanguage(x) call', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { i18n } = useTranslation();',
        "  return <button onClick={() => i18n.changeLanguage('es')}>ES</button>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain('useSetLocale()');
    expect(code).toContain("i18n('es')");
  });
});

describe('adversary m1: dynamic t() keys', () => {
  it('emits a TODO for a template-literal key', () => {
    const { todos } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C({ k }) {',
        '  const { t } = useTranslation();',
        '  return <p>{t(`dynamic.${k}`)}</p>;',
        '}',
      ].join('\n')
    );
    expect(todos.some((td) => /dynamic translation key/.test(td.reason))).toBe(
      true
    );
  });

  it('emits a TODO for a variable key', () => {
    const { todos } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C({ key }) {',
        '  const { t } = useTranslation();',
        '  return <p>{t(key)}</p>;',
        '}',
      ].join('\n')
    );
    expect(todos.some((td) => /dynamic translation key/.test(td.reason))).toBe(
      true
    );
  });
});

describe('adversary m3: provider spread / unused i18n', () => {
  it('skips a provider with a spread attribute', () => {
    const { code, skipReasons } = transform(
      [
        "import { I18nextProvider } from 'react-i18next';",
        'export function P({ children, ...rest }) {',
        '  return <I18nextProvider {...rest} i18n={i18n}>{children}</I18nextProvider>;',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.length).toBeGreaterThan(0);
  });

  it('skips a provider with a prop besides i18n', () => {
    const { code, skipReasons } = transform(
      [
        "import { I18nextProvider } from 'react-i18next';",
        'export function P({ children }) {',
        '  return <I18nextProvider i18n={i18n} defaultNS="common">{children}</I18nextProvider>;',
        '}',
      ].join('\n')
    );
    expect(code).toBeNull();
    expect(skipReasons.length).toBeGreaterThan(0);
  });

  it('does not emit useSetLocale for an unreferenced i18n', () => {
    const { code, skipReasons } = transform(
      [
        "import { useTranslation } from 'react-i18next';",
        'export function C() {',
        '  const { t, i18n } = useTranslation();',
        "  return <p>{t('x')}</p>;",
        '}',
      ].join('\n')
    );
    expect(skipReasons).toEqual([]);
    expect(code).toContain('useTranslations()');
    expect(code).not.toContain('useSetLocale');
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

  it('adds the gt-next import when one combined import retains the provider and migrates the hook', () => {
    // A single `{ useTranslation, I18nextProvider }` declaration under
    // retainProvider: the provider specifier is kept but the hook is migrated
    // to useTranslations(), so the gt-next import must still be added; the
    // retained-import branch used to `continue` past the insertion site.
    const { code } = transform(
      [
        "import { useTranslation, I18nextProvider } from 'react-i18next';",
        "import i18n from './i18n';",
        'export function C() {',
        '  const { t } = useTranslation();',
        '  return (',
        '    <I18nextProvider i18n={i18n}>',
        "      <p>{t('title')}</p>",
        '    </I18nextProvider>',
        '  );',
        '}',
      ].join('\n'),
      { title: 'Welcome' },
      { retainProvider: true }
    );
    expect(code).not.toBeNull();
    // The migrated hook has its import...
    expect(code).toMatch(/import \{ useTranslations \} from 'gt-next'/);
    expect(code).toContain('useTranslations()');
    // ...and the provider (and its react-i18next import) is retained.
    expect(code).toContain('<I18nextProvider');
    expect(code).toMatch(/import \{ I18nextProvider \} from 'react-i18next'/);
    // The migrated file must still parse as valid TS/JSX.
    expect(() =>
      parse(code!, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    ).not.toThrow();
  });
});
