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

function makeContext(messages: Record<string, unknown> = {}): MigrationContext {
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

  it('skips a formatMessage call whose message or values are rich', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'terms' }, { b: (chunks) => <b>{chunks}</b> })}</p>;",
        '}'
      ),
      { terms: 'Accept the <b>terms</b>' }
    );
    expect(r.code).toBeNull();
    const reason = r.skipReasons.join(' ');
    expect(reason).toMatch(/formatMessage\('terms'\)/);
    expect(reason).toMatch(/convert manually/);
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

  it('emits a dotted id and resolves it against the re-nested catalog', () => {
    // Discovery re-nests dotted flat keys, so the migrate-time presence check
    // walks 'Home.title' through { Home: { title } } exactly as gt-next's
    // runtime resolver (id.split('.')) does — check and runtime never disagree.
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'Home.title' })}</p>;",
        '}'
      ),
      { Home: { title: 'Welcome' } }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]Home\.title['"]\)/);
    expect(r.code).toMatch(/useTranslations\(\)/);
  });

  it('skips a dotted id whose nested path is absent (flat catalog not re-nested)', () => {
    // A FLAT { 'Home.title': … } catalog is the pre-fix runtime bug: gt-next
    // walks 'Home.title' as a nested path and throws. The presence check now
    // walks the same way, so it correctly reports the miss instead of emitting
    // a call that throws at runtime.
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
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/source entry|catalog/i);
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

  it('retains the provider untouched under retainProvider', () => {
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
    const r = transform(code, {}, { retainProvider: true });
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

  it('skips rich text on the dictionary path', () => {
    const r = transform(richFile, { terms: 'Accept the <b>terms</b>' });
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/convert manually/);
  });

  it('skips a non-trivial rich chunk (element-producing values)', () => {
    const r = transform(
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

// Faithful copy of gt-next's runtime dictionary resolver: DictionaryCache
// (server getTranslations) and react-core's lookupDictionaryValue (client
// useTranslations) both walk id.split('.') through nested objects. This is the
// exact semantics the migrate-time presence check (catalogMessage) must match.
function resolveNested(
  dictionary: Record<string, unknown>,
  id: string
): string | undefined {
  let current: unknown = dictionary;
  for (const segment of id.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('reactIntl: dotted-id nested resolution (B1)', () => {
  it('a re-nested catalog resolves the emitted dotted id; a flat one does not', () => {
    // What discovery produces (nested) resolves; the react-intl-verbatim flat
    // catalog is exactly the reported runtime throw.
    expect(
      resolveNested({ Home: { title: 'Welcome home' } }, 'Home.title')
    ).toBe('Welcome home');
    expect(
      resolveNested({ 'Home.title': 'Welcome home' }, 'Home.title')
    ).toBeUndefined();
    // control: a non-dotted (hash-style) id resolves fine in a flat map.
    expect(resolveNested({ xK2p9a: 'Hi' }, 'xK2p9a')).toBe('Hi');
  });

  it('emits a call the nested catalog resolves for a deeply dotted id', () => {
    const messages = { a: { b: { c: 'deep' } } };
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'a.b.c' })}</p>;",
        '}'
      ),
      messages
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/intl\(['"]a\.b\.c['"]\)/);
    // the id the transform emits resolves through the nested catalog at runtime.
    expect(resolveNested(messages, 'a.b.c')).toBe('deep');
  });

  it('skips a flat/nested key collision reported by discovery', () => {
    // Discovery drops colliding ids and flags them; the transform must skip any
    // file that references one rather than emit a call that cannot resolve.
    const ctx = makeContext({ a: 'A' });
    ctx.catalogs.flatKeyCollisions = ['a', 'a.b'];
    const r = transformSourceFile(
      'src/app/[locale]/Client.tsx',
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'a' })}</p>;",
        '}'
      ),
      ctx
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/collide/i);
  });
});

describe('reactIntl: <FormattedMessage> in expression positions (B2)', () => {
  // Every position sits inside a component so the injected useTranslations() hook
  // has a home; the transform must emit the hook DECLARATION, not just the call.
  const positions: Array<[string, string]> = [
    [
      'return argument',
      'export function C() { return <FormattedMessage id="title" />; }',
    ],
    [
      'arrow implicit body (expression)',
      'export const C = () => <FormattedMessage id="title" />;',
    ],
    [
      'arrow implicit body (JSX child)',
      'export const C = () => <div><FormattedMessage id="title" /></div>;',
    ],
    [
      'const init',
      'export function C() { const el = <FormattedMessage id="title" />; return <div>{el}</div>; }',
    ],
    [
      'object value',
      'export function C() { const o = { a: <FormattedMessage id="title" /> }; return <div>{o.a}</div>; }',
    ],
    [
      'ternary branch',
      'export function C({ b }: { b: boolean }) { return <div>{b ? <FormattedMessage id="title" /> : null}</div>; }',
    ],
    [
      'array element',
      'export function C() { const a = [<FormattedMessage id="title" key="t" />]; return <div>{a}</div>; }',
    ],
  ];

  it.each(positions)(
    'converts a <FormattedMessage> in %s and declares its hook',
    (_name, body) => {
      const code = lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        body
      );
      const r = transform(code, { title: 'Welcome' });
      expect(r.skipReasons).toEqual([]);
      expect(r.code).not.toBeNull();
      expect(r.code).not.toContain('FormattedMessage');
      // The bare call is emitted...
      expect(r.code).toMatch(/\$gtT\(['"]title['"]\)/);
      // ...AND so is its declaration (never a free `$gtT`, TS2304/ReferenceError).
      expect(r.code).toMatch(/const \$gtT = useTranslations\(\)/);
    }
  );

  it('still wraps a JSX-child <FormattedMessage> in an expression container', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  return <div><FormattedMessage id="title" /></div>;',
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/\{\s*\$gtT\(['"]title['"]\)\s*\}/);
    expect(r.code).toMatch(/const \$gtT = useTranslations\(\)/);
  });

  it('reuses an in-scope binding instead of injecting a second hook', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        '  const el = <FormattedMessage id="title" />;',
        '  return <div>{el}{intl.formatMessage({ id: "greeting" })}</div>;',
        '}'
      ),
      { title: 'Welcome', greeting: 'Hi' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const intl = useTranslations\(\)/);
    expect(r.code).toMatch(/const el = intl\(['"]title['"]\)/);
    // No second, undeclared hook binding is introduced.
    expect(r.code).not.toContain('$gtT');
  });

  it('skips a module-scope <FormattedMessage> rather than emit an undeclared hook', () => {
    // No enclosing component: useTranslations() cannot be called at module scope,
    // so injecting `$gtT` would leave it undeclared. Skip the whole file instead.
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'const el = <FormattedMessage id="title" />;',
        'export { el };'
      ),
      { title: 'Welcome' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.length).toBeGreaterThan(0);
    expect(r.skipReasons.join(' ')).toMatch(/module scope|component/i);
    expect(r.code ?? '').not.toContain('$gtT');
  });
});

describe('reactIntl: <FormattedMessage> hook ownership across callbacks (H1)', () => {
  it('lands the injected hook in the component, not the map callback', () => {
    // items.map(item => <FormattedMessage/>) must not get useTranslations()
    // injected into the callback arrow (a rules-of-hooks violation); the hook
    // belongs to the enclosing component and the callback closes over it.
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function List({ items }: { items: string[] }) {',
        '  return <ul>{items.map((item) => <li key={item}><FormattedMessage id="row" /></li>)}</ul>;',
        '}'
      ),
      { row: 'Row' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toBeNull();
    // The declaration sits in the component body, immediately after its `{`.
    expect(r.code).toMatch(
      /function List\([^)]*\)\s*(?::[^{]*)?\{\s*const \$gtT = useTranslations\(\)/
    );
    // The callback references the binding it closes over...
    expect(r.code).toMatch(/items\.map\(\(item\) =>[^)]*\$gtT\(['"]row['"]\)/);
    // ...and never declares its own hook inside the arrow.
    expect(r.code).not.toMatch(/=>\s*\{?\s*const \$gtT = useTranslations/);
  });

  it('reuses a component-level intl binding from inside a callback', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        'export function List({ items }: { items: string[] }) {',
        '  const intl = useIntl();',
        '  return <ul>{items.map((item) => <li key={item}><FormattedMessage id="row" /></li>)}</ul>;',
        '}'
      ),
      { row: 'Row' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const intl = useTranslations\(\)/);
    // The callback reuses `intl`; no second hook is injected.
    expect(r.code).toMatch(/items\.map\(\(item\) =>[^)]*intl\(['"]row['"]\)/);
    expect(r.code).not.toContain('$gtT');
  });

  it('resolves a callback inside a plain helper to that helper', () => {
    // A helper isn't a component, but the pre-existing contract already injects
    // a hook into whatever function directly encloses a <FormattedMessage>; the
    // climb keeps that behavior instead of burying the hook in the callback.
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'function buildRows(items: string[]) {',
        '  return items.map((item) => <li key={item}><FormattedMessage id="row" /></li>);',
        '}',
        'export { buildRows };'
      ),
      { row: 'Row' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(
      /function buildRows\([^)]*\)\s*(?::[^{]*)?\{\s*const \$gtT = useTranslations\(\)/
    );
    expect(r.code).toMatch(/items\.map\(\(item\) =>[^)]*\$gtT\(['"]row['"]\)/);
  });

  it('skips a callback at module scope with no legal hook owner', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export const rows = [1, 2].map((n) => <li key={n}><FormattedMessage id="row" /></li>);'
      ),
      { row: 'Row' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.length).toBeGreaterThan(0);
    expect(r.skipReasons.join(' ')).toMatch(/module scope|component/i);
    expect(r.code ?? '').not.toContain('$gtT');
  });

  it('keeps a memo()-wrapped component as a legal hook owner', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { memo } from 'react';",
        "import { FormattedMessage } from 'react-intl';",
        'export const C = memo(() => <div><FormattedMessage id="row" /></div>);'
      ),
      { row: 'Row' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(
      /memo\(\(\) =>[^;]*const \$gtT = useTranslations\(\)/
    );
    expect(r.code).toMatch(/\$gtT\(['"]row['"]\)/);
  });
});

describe('reactIntl: destructured useIntl and the import-survivor guard (B3)', () => {
  it('rewrites const { formatMessage } = useIntl() and its bare calls', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const { formatMessage } = useIntl();',
        "  return <p>{formatMessage({ id: 'title' })}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const formatMessage = useTranslations\(\)/);
    expect(r.code).toMatch(/formatMessage\(['"]title['"]\)/);
    expect(r.code).not.toMatch(/['"]react-intl['"]/);
    expect(r.code).not.toContain('useIntl');
  });

  it('handles an aliased destructure { formatMessage: t }', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const { formatMessage: t } = useIntl();',
        "  return <p>{t({ id: 'title' })}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).toMatch(/const t = useTranslations\(\)/);
    expect(r.code).toMatch(/\bt\(['"]title['"]\)/);
  });

  it('skips a destructure with a non-formatMessage member', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C({ n }: { n: number }) {',
        '  const { formatMessage, formatNumber } = useIntl();',
        "  return <p>{formatMessage({ id: 'title' })}{formatNumber(n)}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/formatNumber/);
  });

  it('skips (never emits broken code) when a react-intl import reference survives conversion', () => {
    // useIntl captured as a value (not a recognized `const x = useIntl()`
    // binding), so nothing consumes the import — stripping it would leave a
    // dangling reference. The general guard forces a whole-file skip.
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'const useHook = useIntl;',
        'export function C() {',
        '  const intl = useHook();',
        "  return <p>{intl.formatMessage({ id: 'title' })}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.length).toBeGreaterThan(0);
    expect(r.skipReasons.join(' ')).toMatch(/still referenced|useIntl/);
  });
});

describe('reactIntl: scope-aware intl.formatMessage (M1)', () => {
  it('rewrites the captured useIntl binding but not an unrelated intl prop', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'a' })}</p>;",
        '}',
        'export function D({ intl }: { intl: any }) {',
        "  return <p>{intl.formatMessage({ id: 'b' })}</p>;",
        '}'
      ),
      { a: 'A', b: 'B' }
    );
    expect(r.skipReasons).toEqual([]);
    // C's captured binding is rewritten to the bare t() call...
    expect(r.code).toMatch(/return <p>\{intl\(['"]a['"]\)\}/);
    // ...but D's prop `intl` (a react-intl IntlShape) is left untouched.
    expect(r.code).toMatch(/intl\.formatMessage\(\{\s*id:\s*['"]b['"]\s*\}\)/);
  });
});

describe('reactIntl: JSX-element values are rich (m1)', () => {
  const elementValueFile = lines(
    "'use client';",
    "import { FormattedMessage } from 'react-intl';",
    'export function C() {',
    '  return <p><FormattedMessage id="g" values={{ icon: <b>x</b>, name: "Bob" }} /></p>;',
    '}'
  );

  it('skips a plain message with a JSX-element value on the dictionary path', () => {
    const r = transform(elementValueFile, { g: 'Hi {name} {icon}' });
    expect(r.code).toBeNull();
    const reason = r.skipReasons.join(' ');
    expect(reason).toMatch(/convert manually/);
    // The trigger is a JSX-element value, not a rich-text tag in the message —
    // the wording must name what actually fired.
    expect(reason).toMatch(/JSX-element|element value|chunk-function/i);
    expect(reason).not.toMatch(/rich-text tags/);
  });
});

describe('reactIntl: IntlProvider extra props are skipped (B4)', () => {
  const providerWith = (attrs: string) =>
    lines(
      "'use client';",
      "import { IntlProvider } from 'react-intl';",
      'export function P({ locale, messages, children }: any) {',
      `  return <IntlProvider locale={locale} messages={messages} ${attrs}>{children}</IntlProvider>;`,
      '}'
    );

  it('skips+reports timeZone with its own message', () => {
    const r = transform(providerWith('timeZone="America/New_York"'));
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/timeZone/);
    expect(r.skipReasons.join(' ')).toMatch(/date\/time|timezone/i);
  });

  it.each([
    ['onError', 'onError={reportError}'],
    ['textComponent', "textComponent={'span'}"],
    ['formats', 'formats={{}}'],
    ['defaultRichTextElements', 'defaultRichTextElements={{}}'],
  ])('skips+reports %s', (name, attr) => {
    const r = transform(providerWith(attr));
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toContain(name);
  });

  it('skips+reports a spread prop', () => {
    const r = transform(providerWith('{...extra}'));
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/spread/);
  });

  it('still unwraps a provider carrying only locale/defaultLocale/messages', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { IntlProvider } from 'react-intl';",
        'export function P({ locale, messages, children }: any) {',
        '  return <IntlProvider locale={locale} defaultLocale="en" messages={messages}>{children}</IntlProvider>;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toContain('IntlProvider');
  });

  it('unwraps a provider carrying React reserved key/ref plus the config props', () => {
    // key/ref are React reserved props, not react-intl config — unwrapping drops
    // them harmlessly, so the provider must still convert cleanly (not skip).
    const r = transform(
      lines(
        "'use client';",
        "import { IntlProvider } from 'react-intl';",
        'export function W({ locale, messages, children }: any) {',
        '  return <IntlProvider key={locale} ref={undefined} locale={locale} defaultLocale="en" messages={messages}>{children}</IntlProvider>;',
        '}'
      )
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toContain('IntlProvider');
  });

  it('reports only the prop actually present (no lecturing about absent props)', () => {
    const r = transform(providerWith('onError={reportError}'));
    expect(r.code).toBeNull();
    const reason = r.skipReasons.join(' ');
    expect(reason).toContain('onError');
    // The old composite reason lectured about textComponent/defaultRichTextElements
    // even when they were absent; each reason must name only its own prop.
    expect(reason).not.toContain('textComponent');
    expect(reason).not.toContain('defaultRichTextElements');
  });
});

describe('reactIntl: re-exports from react-intl are skipped and reported (New #3)', () => {
  it('skips+reports a named re-export from react-intl', () => {
    const r = transform("export { useIntl } from 'react-intl';");
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/re-export/i);
    expect(r.skipReasons.join(' ')).toMatch(/react-intl/);
  });

  it('skips+reports a star re-export from react-intl', () => {
    const r = transform("export * from 'react-intl';");
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/re-export/i);
  });

  it('skips+reports a re-export from an @formatjs/* source', () => {
    const r = transform("export { FormattedMessage } from '@formatjs/intl';");
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/re-export/i);
  });

  it('reports a re-export alongside convertible imports (does not silently strip)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        "export { FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ id: 'title' })}</p>;",
        '}'
      ),
      { title: 'Welcome' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/re-export/i);
  });
});

describe('reactIntl: auto-generated ids (M3)', () => {
  it('reports the real cause (no literal id) and raises a top-level warning', () => {
    const ctx = makeContext({ existing: 'x' });
    const r = transformSourceFile(
      'src/app/[locale]/Client.tsx',
      lines(
        "'use client';",
        "import { FormattedMessage } from 'react-intl';",
        'export function C() {',
        '  return <p><FormattedMessage defaultMessage="Hello" /></p>;',
        '}'
      ),
      ctx
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/no literal id|auto-generate/i);
    expect(r.skipReasons.join(' ')).not.toMatch(/dynamic descriptor/);
    expect((ctx.warnings ?? []).join(' ')).toMatch(
      /auto-generated ids|literal `id`/i
    );
  });

  it('reports auto-generated ids on a formatMessage descriptor too', () => {
    const ctx = makeContext({ existing: 'x' });
    const r = transformSourceFile(
      'src/app/[locale]/Client.tsx',
      lines(
        "'use client';",
        "import { useIntl } from 'react-intl';",
        'export function C() {',
        '  const intl = useIntl();',
        "  return <p>{intl.formatMessage({ defaultMessage: 'Cart' })}</p>;",
        '}'
      ),
      ctx
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(/no literal id/i);
    expect((ctx.warnings ?? []).join(' ')).toMatch(/auto-generated ids/i);
  });
});

describe('reactIntl: R2 module-scope useIntl() binding', () => {
  it('skips+reports a module-scope useIntl() reused inside a component', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        // Invalid react-intl: a hook called at module scope. Migrating it to a
        // module-scope useTranslations() would carry that violation into output.
        'const intl = useIntl();',
        'export function Title() {',
        '  return <h1>{intl.formatMessage({ id: "title" })}</h1>;',
        '}',
        'export function Sub() {',
        '  return <p><FormattedMessage id="sub" /></p>;',
        '}'
      ),
      { title: 'Welcome', sub: 'Sub' }
    );
    expect(r.code).toBeNull();
    expect(r.skipReasons.join(' ')).toMatch(
      /useIntl\(\) is called at module scope.*rules of hooks/
    );
  });

  it('still transforms an in-component useIntl() binding (no false skip)', () => {
    const r = transform(
      lines(
        "'use client';",
        "import { useIntl, FormattedMessage } from 'react-intl';",
        'export function Title() {',
        '  const intl = useIntl();',
        '  return (',
        '    <h1>',
        '      {intl.formatMessage({ id: "title" })}',
        '      <FormattedMessage id="sub" />',
        '    </h1>',
        '  );',
        '}'
      ),
      { title: 'Welcome', sub: 'Sub' }
    );
    expect(r.skipReasons).toEqual([]);
    expect(r.code).not.toBeNull();
    expect(r.code).toContain('useTranslations()');
  });
});
