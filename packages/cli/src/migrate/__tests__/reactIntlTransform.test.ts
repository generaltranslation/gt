import { describe, expect, it } from 'vitest';
import { reactIntlAdapter } from '../adapters/reactIntl.js';
import { transformSourceFile } from '../transformSource.js';
import type { TransformOptions } from '../transformSource.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';

const routing: RoutingInfo = {
  locales: null,
  defaultLocale: null,
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(
  messages: Record<string, unknown> = {},
  opts: { inline?: boolean } = {}
): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    byLocale: { en: messages, fr: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing,
    adapter: reactIntlAdapter,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    inlineMode: opts.inline,
  };
}

function transform(
  code: string,
  messages: Record<string, unknown> = {},
  options: TransformOptions = {}
) {
  return transformSourceFile(
    'src/app/[locale]/Client.tsx',
    code,
    makeContext(messages),
    options
  );
}

function transformInline(code: string, messages: Record<string, unknown> = {}) {
  return transformSourceFile(
    'src/app/[locale]/Client.tsx',
    code,
    makeContext(messages, { inline: true })
  );
}

const lines = (...l: string[]) => l.join('\n');

describe('reactIntl: files without react-intl', () => {
  it('returns unchanged for files that never import react-intl', () => {
    const r = transform('export const x = 1;');
    expect(r.code).toBeNull();
    expect(r.skipReasons).toEqual([]);
  });

  it('returns unchanged for a react-intl mention in a string, not an import', () => {
    const r = transform('export const note = "we used react-intl once";');
    expect(r.code).toBeNull();
    expect(r.skipReasons).toEqual([]);
  });
});

describe('reactIntl: useIntl().formatMessage (client)', () => {
  it('rewrites the useIntl binding to useTranslations and calls t(id)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'title' })}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const intl = useTranslations\(\)/);
    expect(r.code).toMatch(/intl\(['"]title['"]\)/);
    expect(r.code).toMatch(/import \{ useTranslations \} from ['"]gt-next['"]/);
    expect(r.code).not.toMatch(/['"]react-intl['"]/);
    expect(r.code).not.toContain('useIntl');
  });

  it('passes values through to t(id, values)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C({ name }: { name: string }) {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'greeting' }, { name })}</p>;",
        '}'
      ),
      { greeting: 'Hi {name}' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]greeting['"], \{ name \}\)/);
  });

  it('preserves a dotted id verbatim (no rootId splitting)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'Home.title' })}</p>;",
        '}'
      ),
      { 'Home.title': 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]Home\.title['"]\)/);
    expect(r.code).toMatch(/useTranslations\(\)/);
  });

  it('resolves an id from a defineMessages table and drops the table', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, defineMessages } from 'react-intl';",
        'const m = defineMessages({',
        "  cart: { id: 'cart', defaultMessage: 'Cart' },",
        '});',
        'export function C() {',
        '  const intl = useIntl();',
        '  return <h2>{intl.formatMessage(m.cart)}</h2>;',
        '}'
      ),
      { cart: 'Cart' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]cart['"]\)/);
    expect(r.code).not.toContain('defineMessages');
  });

  it('skips a dynamic descriptor id', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C({ key }: { key: string }) {',
        '  const intl = useIntl();',
        '  return <p>{intl.formatMessage({ id: key })}</p>;',
        '}'
      ),
      { title: 'x' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/dynamic/i);
  });

  it('skips an id with no source entry in the default catalog', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'ghost' })}</p>;",
        '}'
      ),
      { title: 'x' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/catalog|source entry|unknown/i);
  });

  it('skips a non-formatMessage intl method (no bare hook)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C({ n }: { n: number }) {',
        '  const intl = useIntl();',
        '  return <p>{intl.formatNumber(n)}</p>;',
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/formatNumber/);
  });
});

describe('reactIntl: createIntl (server/RSC)', () => {
  it('rewrites createIntl in an async component to await getTranslations()', () => {
    const r = transform(
      lines(
        "import { createIntl } from 'react-intl';",
        'export default async function Page() {',
        "  const intl = createIntl({ locale: 'en', messages: {} });",
        "  return <h1>{intl.formatMessage({ id: 'title' })}</h1>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const intl = await getTranslations\(\)/);
    expect(r.code).toMatch(/intl\(['"]title['"]\)/);
    expect(r.code).toMatch(
      /import \{ getTranslations \} from ['"]gt-next\/server['"]/
    );
    expect(r.code).not.toMatch(/['"]react-intl['"]/);
  });

  it('drops createIntlCache', () => {
    const r = transform(
      lines(
        "import { createIntl, createIntlCache } from 'react-intl';",
        'const cache = createIntlCache();',
        'export default async function Page() {',
        "  const intl = createIntl({ locale: 'en', messages: {} }, cache);",
        "  return <h1>{intl.formatMessage({ id: 'title' })}</h1>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toContain('createIntlCache');
    expect(r.code).not.toContain('cache');
  });

  it('skips createIntl inside a synchronous helper', () => {
    const r = transform(
      lines(
        "import { createIntl } from 'react-intl';",
        'function helper() {',
        "  const intl = createIntl({ locale: 'en', messages: {} });",
        "  return intl.formatMessage({ id: 'title' });",
        '}',
        'export default function Page() {',
        '  return <h1>{helper()}</h1>;',
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/async|createIntl/);
  });
});

describe('reactIntl: <FormattedMessage>', () => {
  it('injects useTranslations and wraps in {t(id, values)}', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C({ name }: { name: string }) {',
        '  return <p><FormattedMessage id="greeting" values={{ name }} /></p>;',
        '}'
      ),
      { greeting: 'Hi {name}' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/useTranslations\(\)/);
    expect(r.code).toMatch(/\$gtT\(['"]greeting['"], \{\s*name\s*\}\)/);
    expect(r.code).toMatch(/import \{ useTranslations \} from ['"]gt-next['"]/);
    expect(r.code).not.toContain('FormattedMessage');
  });

  it('reuses an in-scope useIntl binding instead of injecting', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        '  return (',
        '    <>',
        "      <p>{intl.formatMessage({ id: 'a' })}</p>",
        '      <p><FormattedMessage id="b" /></p>',
        '    </>',
        '  );',
        '}'
      ),
      { a: 'A', b: 'B' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]b['"]\)/);
    expect(r.code).not.toContain('$gtT');
  });

  it('skips a dynamic id', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C({ id }: { id: string }) {',
        '  return <p><FormattedMessage id={id} /></p>;',
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/dynamic|missing id/i);
  });

  it('skips render-prop children', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  return (',
        '    <FormattedMessage id="a">',
        '      {(txt) => <strong>{txt}</strong>}',
        '    </FormattedMessage>',
        '  );',
        '}'
      ),
      { a: 'A' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/render-prop/i);
  });
});

describe('reactIntl: value formatters', () => {
  it('converts FormattedNumber to <Num options>', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedNumber } from 'react-intl';",
        'export function C({ price }: { price: number }) {',
        '  return <FormattedNumber value={price} style="currency" currency="USD" />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<Num options=\{\{[^}]*currency: ['"]USD['"]/);
    expect(r.code).toMatch(/>\{price\}<\/Num>/);
    expect(r.code).toMatch(/import \{ Num \} from ['"]gt-next['"]/);
  });

  it('converts FormattedDate to <DateTime>', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedDate } from 'react-intl';",
        'export function C({ when }: { when: Date }) {',
        '  return <FormattedDate value={when} year="numeric" month="long" />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<DateTime options=/);
    expect(r.code).toMatch(/>\{when\}<\/DateTime>/);
  });

  it('gives FormattedTime an explicit hour/minute default', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedTime } from 'react-intl';",
        'export function C({ when }: { when: Date }) {',
        '  return <FormattedTime value={when} />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/hour: ['"]numeric['"]/);
    expect(r.code).toMatch(/minute: ['"]numeric['"]/);
    expect(r.code).toMatch(/<DateTime/);
  });

  it('converts FormattedPlural to <Plural n>', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedPlural } from 'react-intl';",
        'export function C({ count }: { count: number }) {',
        '  return <FormattedPlural value={count} one="one item" other="# items" />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<Plural[^>]*n=\{count\}/);
    expect(r.code).toMatch(/one="one item"/);
    expect(r.code).toMatch(/other="# items"/);
  });

  it('converts FormattedRelativeTime and flags updateIntervalInSeconds', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedRelativeTime } from 'react-intl';",
        'export function C({ secs }: { secs: number }) {',
        '  return <FormattedRelativeTime value={secs} unit="second" updateIntervalInSeconds={1} />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<RelativeTime/);
    expect(r.code).not.toContain('updateIntervalInSeconds');
    expect(r.todos.some((t) => /updateIntervalInSeconds/.test(t.reason))).toBe(
      true
    );
  });

  it('converts an aliased value-formatter import', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedNumber as FN } from 'react-intl';",
        'export function C({ price }: { price: number }) {',
        '  return <FN value={price} />;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<Num/);
    expect(r.code).not.toContain('<FN');
  });

  it('skips a value formatter with spread props', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedNumber } from 'react-intl';",
        'export function C({ props }: { props: any }) {',
        '  return <FormattedNumber {...props} />;',
        '}'
      )
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/spread/);
  });
});

describe('reactIntl: IntlProvider', () => {
  it('unwraps the provider to a fragment on a full migration', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { IntlProvider } from 'react-intl';",
        'export function Providers({ locale, messages, children }: any) {',
        '  return (',
        '    <IntlProvider locale={locale} messages={messages}>',
        '      {children}',
        '    </IntlProvider>',
        '  );',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toContain('IntlProvider');
    expect(r.code).toMatch(/<>[\s\S]*\{children\}[\s\S]*<\/>/);
  });

  it('retains the provider untouched under retainNextIntlProvider', () => {
    const code = lines(
      "'use client';",
      "import { IntlProvider } from 'react-intl';",
      'export function Providers({ locale, messages, children }: any) {',
      '  return (',
      '    <IntlProvider locale={locale} messages={messages}>',
      '      {children}',
      '    </IntlProvider>',
      '  );',
      '}'
    );
    const r = transform(code, {}, { retainNextIntlProvider: true });
    // Nothing convertible remains, so the file is left as-is.
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toBeNull();
  });
});

describe('reactIntl: defineMessages', () => {
  it('skips a defineMessages block with a non-literal id', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, defineMessages } from 'react-intl';",
        'const m = defineMessages({',
        '  cart: { id: someId, defaultMessage: "Cart" },',
        '});',
        'export function C() {',
        '  const intl = useIntl();',
        '  return <h2>{intl.formatMessage(m.cart)}</h2>;',
        '}'
      ),
      { cart: 'Cart' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/defineMessages|literal/);
  });
});

describe('reactIntl: rich text', () => {
  const richFile = lines(
    "'use client';",
    "import { FormattedMessage } from 'react-intl';",
    'export function C() {',
    '  return (',
    '    <p>',
    '      <FormattedMessage id="terms" values={{ b: (chunks) => <b>{chunks}</b> }} />',
    '    </p>',
    '  );',
    '}'
  );

  it('skips rich text on the dictionary path (non-inline)', () => {
    const r = transform(richFile, { terms: 'Accept the <b>terms</b>' });
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/--inline/);
  });

  it('converts rich text to inline <T> under --inline', () => {
    const r = transformInline(richFile, { terms: 'Accept the <b>terms</b>' });
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/<T>/);
    expect(r.code).toMatch(/<b>/);
    expect(r.code).not.toContain('FormattedMessage');
    expect(r.todos.some((t) => /npx gt translate/.test(t.reason))).toBe(true);
  });

  it('skips a non-trivial rich chunk even under --inline', () => {
    const r = transformInline(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  return (',
        '    <FormattedMessage id="terms" values={{ b: (chunks) => <b>{chunks}!</b> }} />',
        '  );',
        '}'
      ),
      { terms: 'Accept the <b>terms</b>' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.length).toBeGreaterThan(0);
  });
});

describe('reactIntl: unsupported APIs skip whole file and report', () => {
  const cases: Array<[string, string, RegExp]> = [
    [
      'injectIntl',
      lines(
        "import { injectIntl } from 'react-intl';",
        'class C extends React.Component { render() { return null; } }',
        'export default injectIntl(C);'
      ),
      /injectIntl/,
    ],
    [
      'RawIntlProvider',
      lines(
        "import { RawIntlProvider } from 'react-intl';",
        'export function C({ intl, children }: any) {',
        '  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;',
        '}'
      ),
      /RawIntlProvider/,
    ],
    [
      'FormattedList',
      lines(
        "import { FormattedList } from 'react-intl';",
        'export function C({ items }: any) {',
        '  return <FormattedList value={items} type="conjunction" />;',
        '}'
      ),
      /FormattedList/,
    ],
    [
      'FormattedDisplayName',
      lines(
        "import { FormattedDisplayName } from 'react-intl';",
        'export function C() {',
        '  return <FormattedDisplayName value="US" type="region" />;',
        '}'
      ),
      /FormattedDisplayName/,
    ],
    [
      'FormattedNumberParts',
      lines(
        "import { FormattedNumberParts } from 'react-intl';",
        'export function C({ n }: any) {',
        '  return <FormattedNumberParts value={n}>{() => null}</FormattedNumberParts>;',
        '}'
      ),
      /ToParts|FormattedNumberParts/,
    ],
    [
      '@formatjs deep import',
      lines(
        "import { createIntl } from '@formatjs/intl';",
        'export const intl = createIntl({ locale: "en", messages: {} });'
      ),
      /formatjs/i,
    ],
    [
      'default import form',
      lines(
        "import ReactIntl from 'react-intl';",
        'export const x = ReactIntl;'
      ),
      /unsupported.*import form|import form/i,
    ],
  ];

  it.each(cases)('skips %s and reports it', (_name, code, pattern) => {
    const r = transform(code, { a: 'A' });
    expect(r.code).toBeNull();
    expect(r.skipReasons.length).toBeGreaterThan(0);
    expect(r.skipReasons.join(' ')).toMatch(pattern);
  });
});
