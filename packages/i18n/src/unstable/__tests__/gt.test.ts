import { formatCutoff } from '@generaltranslation/format';
import type { MessageNode } from '@generaltranslation/icu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import {
  getI18nCache,
  setI18nCache,
} from '../../i18n-cache/singleton-operations';
import {
  getI18nConfig,
  initializeI18nConfig,
} from '../../i18n-config/singleton-operations';
import { t } from '../../unstable';
import { buildMessage, buildSiteMessage } from '../buildMessage';
import { createGT, getGT } from '../gt';
import type {
  LookupTreeTranslation,
  MessageTreeMetadata,
  PrecomputedMessage,
} from '../renderMessage';
import {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  time,
} from '../placeholders';
import {
  hashSource,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

/** Catalog key of a source template, computed the way gt does. */
function keyOf(metadata: MessageTreeHashMetadata = {}) {
  return (strings: TemplateStringsArray, ...holes: unknown[]) =>
    hashSource({
      source: buildMessage(strings, holes).tree,
      dataFormat: 'MESSAGE_TREE',
      ...metadata,
    });
}

const literal = (value: string): MessageNode => value;
const argument = (value: string): MessageNode => [value];

function setup({
  locale = 'fr',
  enableI18n = true,
  fr = {},
  cacheExpiryTime,
  timeZone,
}: {
  locale?: string;
  enableI18n?: boolean;
  fr?: Record<string, unknown>;
  cacheExpiryTime?: number;
  timeZone?: string;
} = {}) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    timeZone,
  });
  setI18nCache(
    new I18nCache({
      cacheExpiryTime,
      loadTranslations: vi.fn(async (requested: string) =>
        requested === 'fr' ? fr : {}
      ),
    })
  );
  setWritableConditionStore({
    getLocale: () => locale,
    getEnableI18n: () => enableI18n,
  });
  return getGT({ locale, enableI18n });
}

const name = 'Ada';

describe('gt-i18n/unstable rendering', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    resetGTGlobals();
  });

  it('renders the source in the default locale', async () => {
    const gt = await setup({ locale: 'en' });
    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(t`Hello, ${{ name }}!`).toBe('Hello, Ada!');
  });

  it('renders plain values like a template literal', async () => {
    const gt = await setup({ locale: 'en' });
    const flag = false;
    const id = 12n;
    const nickname = undefined;
    expect(gt`Enabled: ${flag}`).toBe('Enabled: false');
    expect(gt`Enabled: ${!flag}`).toBe('Enabled: true');
    expect(gt`Id ${id}`).toBe('Id 12');
    expect(gt`Hi ${nickname}!`).toBe('Hi !');
  });

  it('renders a loaded translated tree', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Hello, ${{ name }}!`]: [
          literal('Bonjour, '),
          argument('name'),
          literal(' !'),
        ],
      },
    });
    expect(gt`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
    expect(t`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
  });

  it('uses the context in the translation key', async () => {
    const gt = await setup({
      fr: { [keyOf({ context: 'button' })`Save`]: 'Enregistrer' },
    });
    expect(gt({ context: 'button' })`Save`).toBe('Enregistrer');
    expect(gt`Save`).toBe('Save');
  });

  it('looks up a compiler-injected $_hash without rehashing', async () => {
    const gt = await setup({ fr: { injected: 'Enregistrer' } });
    // Not in public GTOptions: only emitted JS from the compiler passes it.
    const compiled = { $_hash: 'injected' };
    expect(gt(compiled)`Save`).toBe('Enregistrer');
    expect(t(compiled)`Save`).toBe('Enregistrer');
  });

  it('renders the source on a miss', async () => {
    const gt = await setup();
    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the source when i18n is disabled', async () => {
    const gt = await setup({
      enableI18n: false,
      fr: { [keyOf()`Save`]: 'Enregistrer' },
    });
    expect(gt`Save`).toBe('Save');
    expect(t`Save`).toBe('Save');
  });

  it('treats a cached value that is not a tree as a miss and warns once', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Malformed`]: { text: 'Mal formé' },
        [keyOf()`Bad type`]: [['x', 'bad-kind']],
      },
    });
    expect(gt`Malformed`).toBe('Malformed');
    expect(gt`Malformed`).toBe('Malformed');
    expect(gt`Bad type`).toBe('Bad type');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('renders a translation without placeholders as literal text, empty included', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Save {now}`]: "Enregistrer {now} # l'a",
        [keyOf()`Nothing`]: '',
      },
    });
    expect(gt`Save {now}`).toBe("Enregistrer {now} # l'a");
    expect(gt`Nothing`).toBe('');
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the source when Intl rejects the locale of a translation without placeholders', async () => {
    await setup();
    const gt = createGT({
      getLocale: () => 'fr_FR',
      lookupTranslation: () => 'Enregistrer',
    });
    expect(gt`Save`).toBe('Save');
    expect(gt`Save`).toBe('Save');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Formatting the "fr_FR" translation'
    );
  });

  it('validates a translated tree once', async () => {
    let reads = 0;
    const tree = new Proxy([literal('Bonjour, '), argument('name')], {
      get(target, key, receiver) {
        reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    await setup();
    const gt = createGT({
      getLocale: () => 'fr',
      lookupTranslation: () => tree,
    });
    const render = () => {
      reads = 0;
      expect(gt`Hello, ${{ name }}`).toBe('Bonjour, Ada');
      return reads;
    };
    const first = render();
    const second = render();
    expect(second).toBeLessThan(first);
    expect(render()).toBe(second);
  });

  it('treats a malformed nested branch as a miss', async () => {
    const tree = [['role', 'select', { other: [[['x']]] }]];
    const gt = await setup({ fr: { [keyOf()`Invalid`]: tree } });
    expect(gt`Invalid`).toBe('Invalid');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('treats a tree nested beyond the depth bound as a miss', async () => {
    let tree: unknown = 'deep';
    for (let depth = 0; depth < 100; depth++) {
      tree = [['role', 'select', { other: tree }]];
    }
    const gt = await setup({ fr: { [keyOf()`Deep`]: tree } });
    expect(gt`Deep`).toBe('Deep');
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('keeps getGT translations when cacheExpiryTime is 0', async () => {
    const gt = await setup({
      cacheExpiryTime: 0,
      fr: { [keyOf()`Save`]: 'Enregistrer' },
    });
    expect(gt`Save`).toBe('Enregistrer');
    // The global t reads the expired cache directly.
    expect(t`Save`).toBe('Save');
  });

  it('keeps getGT translations after cacheExpiryTime elapses', async () => {
    vi.useFakeTimers();
    try {
      const gt = await setup({
        cacheExpiryTime: 1000,
        fr: { [keyOf()`Save`]: 'Enregistrer' },
      });
      expect(t`Save`).toBe('Enregistrer');
      vi.advanceTimersByTime(2000);
      expect(t`Save`).toBe('Save');
      expect(gt`Save`).toBe('Enregistrer');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads and validates translations from a custom lookupTranslation', async () => {
    await setup({ locale: 'en' });
    const snapshot: Record<string, unknown> = {
      [`fr:${keyOf()`Save`}`]: 'Enregistrer',
      [`fr:${keyOf()`Cancel`}`]: [{ type: 0, value: 'Annuler' }],
    };
    const lookupTranslation: LookupTreeTranslation = (_message, options) =>
      snapshot[`${options.$locale}:${options.$_hash}`];
    const gt = createGT({ getLocale: () => 'fr', lookupTranslation });
    expect(gt`Save`).toBe('Enregistrer');
    expect(gt`Cancel`).toBe('Cancel');
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('skips a custom lookupTranslation when i18n is disabled', async () => {
    await setup({ locale: 'en' });
    const lookupTranslation = vi.fn(() => 'Replaced');
    const gt = createGT({
      getLocale: () => 'fr',
      getEnableI18n: () => false,
      lookupTranslation,
    });
    expect(gt`Save`).toBe('Save');
    expect(lookupTranslation).not.toHaveBeenCalled();
  });

  it('allows a placeholder name repeated with the same value', async () => {
    const gt = await setup({ locale: 'en' });
    expect(gt`${{ name }} and ${{ name }}`).toBe('Ada and Ada');
  });

  it('throws when a placeholder name is bound to different values', async () => {
    const gt = await setup({ locale: 'en' });
    expect(() => gt`${{ name: 'Ada' }} / ${{ name: 'Grace' }}`).toThrow(
      'gt-i18n Error: The t template placeholder "name" is bound to different values'
    );
    expect(
      () =>
        gt`${{ name: 'Ada' }}: ${plural({ count: 2 }, { other: part`${n} from ${{ name: 'Grace' }}` })}`
    ).toThrow('"name" is bound to different values');
    expect(
      () => gt`${plural({ name: 2 }, { other: part`${n}` })} ${{ name: 'Ada' }}`
    ).toThrow('"name" is bound to different values');
  });

  it('keeps __proto__ as a variable name and select branch', async () => {
    const gt = await setup({ locale: 'en' });
    expect(gt`Hi ${{ ['__proto__']: 'Ada' }}`).toBe('Hi Ada');
    const role = '__proto__' as '__proto__' | 'admin';
    expect(
      gt`${select({ role }, { ['__proto__']: 'Proto', admin: 'Admin' })}`
    ).toBe('Proto');
  });

  it('falls back to the source when the translation fails to format', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Hello, ${{ name }}!`]: [literal('Bonjour, '), argument('nom')],
      },
    });
    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('gt-i18n Warning:');
  });

  it('applies maxChars with formatCutoff, including negative values', async () => {
    const source = 'Read more about pricing';
    const gt = await setup({ locale: 'en' });
    expect(gt({ maxChars: 12 })`Read more about pricing`).toBe(
      formatCutoff(source, { locales: 'en', maxChars: 12 })
    );
    expect(gt({ maxChars: -12 })`Read more about pricing`).toBe(
      formatCutoff(source, { locales: 'en', maxChars: -12 })
    );
  });

  it('applies maxChars to translations', async () => {
    const translated = 'En savoir plus sur les tarifs';
    const gt = await setup({
      fr: {
        [keyOf({ maxChars: 12 })`Read more about pricing`]: translated,
      },
    });
    expect(gt({ maxChars: 12 })`Read more about pricing`).toBe(
      formatCutoff(translated, { locales: 'fr', maxChars: 12 })
    );
    // The key uses |maxChars|, so the negative form finds the same entry.
    expect(gt({ maxChars: -12 })`Read more about pricing`).toBe(
      formatCutoff(translated, { locales: 'fr', maxChars: -12 })
    );
  });

  it('formats n as the nearest plural count and # as text', async () => {
    const gt = await setup({ locale: 'en' });
    const cart = (count: number) =>
      gt`You have ${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}.`;
    expect(cart(1)).toBe('You have 1 item.');
    expect(cart(1000)).toBe('You have 1,000 items.');
    expect(gt`${plural({ n: 2 }, { other: part`#${n} in line` })}`).toBe(
      '#2 in line'
    );

    const senders = 2;
    const from = part`from ${plural({ senders }, { one: part`${n} person`, other: part`${n} people` })}`;
    expect(
      gt`${plural({ count: 3 }, { one: part`${n} message ${from}`, other: part`${n} messages ${from}` })}`
    ).toBe('3 messages from 2 people');

    expect(() => gt`${n} items`).toThrow('plural count is used outside');
  });

  it('formats helper values passed without a name as anonymous variables', async () => {
    const gt = await setup({ locale: 'en' });
    const count = 2;
    const role = 'admin' as 'admin' | 'member';
    expect(
      gt`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', member: 'members' })}, ${number(0.5, { style: 'percent' })} done by ${date(new Date(Date.UTC(2024, 0, 2)), { timeZone: 'UTC', style: 'medium' })}`
    ).toBe('2 files for admins, 50% done by Jan 2, 2024');
  });

  it('formats a translated plural in the target locale', async () => {
    const count = 2;
    const gt = await setup({
      fr: {
        [keyOf()`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`]:
          [
            [
              'count',
              'plural',
              { one: [0, ' article'], other: [0, ' articles'] },
            ],
          ],
      },
    });
    expect(
      gt`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`
    ).toBe('2 articles');
  });

  it('renders exhaustive selects without an other branch', async () => {
    const gt = await setup({ locale: 'en' });
    const label = (role: 'admin' | 'member') =>
      gt`${select({ role }, { admin: 'Admin', member: 'Member' })}`;
    expect(label('admin')).toBe('Admin');
    expect(label('member')).toBe('Member');
    expect(label('guest' as 'admin')).toBe('');
  });

  it('formats derive() text as static text', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Welcome back!`]: 'Bon retour !',
      },
    });
    // Derived text reads as if written in the template, so it shares the key.
    expect(gt`Welcome ${derive('back')}!`).toBe('Bon retour !');
  });

  it('renders bare values as anonymous arguments', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`${'x'} invited ${'y'}`]: [
          argument('_gt_2'),
          literal(' a invité '),
          argument('_gt_1'),
        ],
      },
    });
    expect(gt`${'Ada'} invited ${'Grace'}`).toBe('Grace a invité Ada');

    // Values are never parsed as ICU.
    const en = await setup({ locale: 'en' });
    expect(en`${'{x}'} has ${3} at ${'#1'}`).toBe('{x} has 3 at #1');
  });

  it('formats number and date options in the rendered locale', async () => {
    const price = 9.5;
    const due = new Date(Date.UTC(2024, 0, 15));
    const currency = 'USD';
    const gt = await setup({
      fr: {
        // The translation holds only the style; the currency is call-site context.
        [keyOf()`Total: ${number({ price }, { style: 'currency', currency: 'EUR' })}`]:
          ['Total : ', ['price', 'number', 'currency']],
      },
    });
    expect(
      gt`Total: ${number({ price }, { style: 'currency', currency })}`
    ).toBe(
      `Total : ${new Intl.NumberFormat('fr', { style: 'currency', currency }).format(price)}`
    );
    // A miss formats the source in the source locale.
    expect(gt`Due ${date({ due }, { style: 'medium', timeZone: 'UTC' })}`).toBe(
      `Due ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(due)}`
    );
  });

  it('formats dates and times in the config time zone unless the call site sets one', async () => {
    const start = new Date(Date.UTC(2024, 0, 15, 23, 30));
    const gt = await setup({ locale: 'en', timeZone: 'Asia/Tokyo' });
    const format = (timeZone: string) =>
      new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone }).format(
        start
      );
    expect(gt`${time({ start }, { style: 'short' })}`).toBe(
      format('Asia/Tokyo')
    );
    expect(gt`${time({ start }, { style: 'short', timeZone: 'UTC' })}`).toBe(
      format('UTC')
    );
  });

  it('uses the host time zone when the config sets none', async () => {
    const hostZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    await setup({ locale: 'en' });
    expect(getI18nConfig().timeZone).toBe(hostZone);
  });

  it('rejects an invalid config time zone', () => {
    expect(() => setup({ timeZone: 'Mars/Olympus' })).toThrow(
      'Invalid time zone "Mars/Olympus"'
    );
  });

  it('accepts placeholders tagged by another copy of gt-i18n', async () => {
    const gt = await setup({ locale: 'en' });
    const foreign = {
      [Symbol.for('gt-i18n.unstable.placeholder')]: 'number',
      name: 'n',
      value: 5,
    };
    expect(gt`${foreign as never}`).toBe('5');
  });

  it('throws a diagnostic for objects that are not named variables', async () => {
    const gt = await setup({ locale: 'en' });
    expect(() => gt`Hello, ${{ name, who: 'Grace' } as never}`).toThrow(
      'gt-i18n Error: A t template placeholder is not a value, a named variable, or a helper'
    );
  });

  it('rejects helper values without exactly one key', () => {
    const values: Record<string, number> = { count: 2, total: 8 };
    const empty: Record<string, number> = {};
    expect(() => number(values)).toThrow('Object keys: count, total');
    expect(() => plural(values, { other: 'x' })).toThrow(
      'Object keys: count, total'
    );
    expect(() => number(empty)).toThrow('Object keys: none');
  });
});

describe('gt-i18n/unstable call sites', () => {
  // One template, so every call is the same call site.
  const greet = (hole: unknown, metadata: MessageTreeMetadata = {}) =>
    ((strings: TemplateStringsArray, ...holes: unknown[]) => ({
      site: buildSiteMessage(strings, holes, metadata),
      built: buildMessage(strings, holes),
    }))`Hello, ${hole}!`;

  it('builds the tree once while the holes keep their names', () => {
    const { site: first } = greet({ name: 'Ada' });
    const { site: second } = greet({ name: 'Grace' });
    expect(first.tree).toEqual(['Hello, ', ['name'], '!']);
    expect(second.tree).toBe(first.tree);
    expect({ ...second.values }).toEqual({ name: 'Grace' });
  });

  it.each([
    ['another name', { user: 'Grace' }],
    ['a value without a name', 'Grace'],
    ['a helper', plural({ count: 2 }, { one: 'one', other: 'more' })],
    ['a helper with other branches', plural({ count: 2 }, { other: 'any' })],
    ['the first name again', { name: 'Grace' }],
  ])('builds the tree again for %s', (_, hole) => {
    greet({ name: 'Ada' });
    const { site, built } = greet(hole);
    expect(site.tree).toEqual(built.tree);
    expect(site.values).toEqual(built.values);
    expect(site.formats).toEqual(built.formats);
  });

  it('checks the values of a tree it reuses', () => {
    const pair = (first: unknown, second: unknown) =>
      ((strings: TemplateStringsArray, ...holes: unknown[]) =>
        buildSiteMessage(strings, holes, {}))`${first} and ${second}`;
    pair({ name: 'Ada' }, { name: 'Ada' });
    expect(() => pair({ name: 'Ada' }, { name: 'Grace' })).toThrow(
      '"name" is bound to different values'
    );
  });

  it('hashes the tree once per metadata', () => {
    const { site: first } = greet({ name: 'Ada' });
    const { site: second } = greet({ name: 'Grace' });
    const { site: button } = greet({ name: 'Ada' }, { context: 'button' });
    const { site: compiled } = greet({ name: 'Ada' }, { $_hash: 'compiled' });
    expect(first.metadata.$_hash).toBe(keyOf()`Hello, ${{ name }}!`);
    expect(second.metadata).toBe(first.metadata);
    expect(button.metadata).toEqual({
      context: 'button',
      $_hash: keyOf({ context: 'button' })`Hello, ${{ name }}!`,
    });
    expect(compiled.metadata).toEqual({ $_hash: 'compiled' });
  });

  it('hashes a template with a helper when it renders', () => {
    const { site } = greet(plural({ count: 2 }, { other: 'any' }));
    expect(site.metadata).toEqual({});
  });
});

describe('gt-i18n/unstable precomputed messages', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    resetGTGlobals();
  });

  type Call = [
    site: PrecomputedMessage,
    values?: Record<string, unknown>,
    formats?: Record<string, object>,
  ];
  // What the compiler emits, which the public GT type does not accept.
  const call = (gt: unknown, ...args: Call) =>
    (gt as (...args: Call) => string)(...args);

  /** The call a compiler emits for a template: its message, then its values. */
  const precompute =
    (metadata: MessageTreeHashMetadata = {}) =>
    (strings: TemplateStringsArray, ...holes: unknown[]): Call => {
      const { tree, values, formats } = buildMessage(strings, holes);
      const site: PrecomputedMessage = {
        $_hash: keyOf(metadata)(strings, ...holes),
        $_tree: tree,
        ...metadata,
      };
      return Object.keys(formats).length
        ? [site, { ...values }, formats]
        : [site, { ...values }];
    };

  const count = 2;
  const role = 'admin' as 'admin' | 'member';
  const due = new Date(Date.UTC(2024, 0, 2));
  const templates: [
    name: string,
    render: (
      tag: (
        metadata?: MessageTreeHashMetadata
      ) => (strings: TemplateStringsArray, ...holes: unknown[]) => unknown
    ) => unknown,
    translation?: unknown,
  ][] = [
    ['text', (tag) => tag()`Save`, 'Enregistrer'],
    ['text without a translation', (tag) => tag()`Cancel`],
    ['empty text', (tag) => tag()``, ''],
    ['context', (tag) => tag({ context: 'button' })`Save`, 'Sauvegarder'],
    [
      'maxChars',
      (tag) => tag({ maxChars: 12 })`Read more about pricing`,
      'En savoir plus sur les tarifs',
    ],
    [
      'negative maxChars on the source',
      (tag) => tag({ maxChars: -12 })`Read more about plans`,
    ],
    [
      'named variables the translation reorders',
      (tag) => tag()`${{ name }} invited ${{ guest: 'Grace' }}`,
      [['guest'], ' invitée par ', ['name']],
    ],
    [
      'plain values',
      (tag) => tag()`${12n} ${false} ${null} ${undefined} ${1.5}`,
    ],
    [
      'a plural',
      (tag) =>
        tag()`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`,
      [['count', 'plural', { one: [0, ' article'], other: [0, ' articles'] }]],
    ],
    [
      'helper values without a name',
      (tag) =>
        tag()`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', member: 'members' })}`,
    ],
    [
      'a select',
      (tag) => tag()`${select({ role }, { admin: 'Admin', member: 'Member' })}`,
      [['role', 'select', { admin: 'Administratrice', other: 'Membre' }]],
    ],
    [
      'number and date formatting context',
      (tag) =>
        tag()`${number({ price: 1234.5 }, { style: 'currency', currency: 'EUR' })} by ${date({ due }, { style: 'medium', timeZone: 'UTC' })} at ${time({ at: due }, { style: 'short', timeZone: 'UTC' })}`,
      [
        ['price', 'number', 'currency'],
        ' avant le ',
        ['due', 'date', 'medium'],
        ' à ',
        ['at', 'time', 'short'],
      ],
    ],
    [
      'a translation that fails to format',
      (tag) => tag()`Hello, ${{ name }}!`,
      ['Bonjour, ', ['nom']],
    ],
    [
      'a translation that is not a tree',
      (tag) => tag()`Malformed`,
      { text: 'Mal formé' },
    ],
  ];

  describe.each(['en', 'fr'])('in %s', (locale) => {
    it.each(templates)(
      'renders %s like its template',
      async (_name, render, translation) => {
        const [site] = render(precompute) as Call;
        const fr =
          translation === undefined ? {} : { [site.$_hash]: translation };
        const template = await setup({ locale, fr });
        const expected = String(
          render((metadata) => (metadata ? template(metadata) : template))
        );
        const templateWarnings = warn.mock.calls.length;
        warn.mockClear();
        resetGTGlobals();

        const gt = await setup({ locale, fr });
        const args = render(precompute) as Call;
        expect(call(gt, ...args)).toBe(expected);
        expect(call(t, ...args)).toBe(expected);
        // Again, from what the call site kept.
        expect(call(gt, ...args)).toBe(expected);
        expect(warn).toHaveBeenCalledTimes(templateWarnings);
      }
    );
  });

  it('renders the source when i18n is disabled', async () => {
    const args = precompute()`Save`;
    const gt = await setup({
      enableI18n: false,
      fr: { [args[0].$_hash]: 'Enregistrer' },
    });
    expect(call(gt, ...args)).toBe('Save');
    expect(call(t, ...args)).toBe('Save');
  });

  it('keeps what a site resolved for its locale', async () => {
    await setup();
    let reads = 0;
    const tree = new Proxy([literal('Bonjour, '), argument('name')], {
      get(target, key, receiver) {
        reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    const inline = vi.fn((locale: string) =>
      locale === 'fr' ? 'Enregistrer' : undefined
    );
    let locale = 'fr';
    const gt = createGT({
      getLocale: () => locale,
      lookupTranslation: () => tree,
    });
    const [greeting, values] = precompute()`Hello, ${{ name }}`;
    const [save] = precompute()`Save`;
    const embedded = { ...save, inline };
    const render = () => {
      reads = 0;
      expect(call(gt, greeting, values)).toBe('Bonjour, Ada');
      expect(call(gt, embedded)).toBe('Enregistrer');
      return reads;
    };

    const first = render();
    const second = render();
    expect(second).toBeLessThan(first);
    expect(render()).toBe(second);
    expect(inline).toHaveBeenCalledTimes(1);

    locale = 'en';
    expect(call(gt, embedded)).toBe('Save');
    locale = 'fr';
    expect(call(gt, embedded)).toBe('Enregistrer');
    expect(inline).toHaveBeenCalledTimes(2);
  });

  it('renders a catalog entry that changes, and one that expires', async () => {
    vi.useFakeTimers();
    try {
      const args = precompute({ maxChars: 12 })`Read more about pricing`;
      const [{ $_hash: hash }] = args;
      const cut = (text: string, locales: string) =>
        formatCutoff(text, { locales, maxChars: 12 });
      await setup({
        cacheExpiryTime: 1000,
        fr: { [hash]: 'En savoir plus sur les tarifs' },
      });
      expect(call(t, ...args)).toBe(cut('En savoir plus sur les tarifs', 'fr'));

      getI18nCache().updateTranslations({
        fr: { [hash]: 'Consulter les tarifs' },
      });
      expect(call(t, ...args)).toBe(cut('Consulter les tarifs', 'fr'));

      vi.advanceTimersByTime(2000);
      expect(call(t, ...args)).toBe(cut('Read more about pricing', 'en'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a replaced tree in its locale without a lookup', async () => {
    await setup();
    const lookupTranslation = vi.fn(() => 'Chargé');
    let locale = 'fr';
    const gt = createGT({ getLocale: () => locale, lookupTranslation });
    const replaced: PrecomputedMessage = {
      $_hash: keyOf()`${number({ total: 1 })} files`,
      $_tree: [['total', 'number'], ' fichiers'],
      $_locale: 'fr',
    };
    expect(call(gt, replaced, { total: 1234.5 })).toBe(
      `${(1234.5).toLocaleString('fr')} fichiers`
    );
    expect(lookupTranslation).not.toHaveBeenCalled();

    // Another locale has no translation here, so it reads its catalog.
    locale = 'en';
    expect(call(gt, replaced, { total: 1234.5 })).toBe('Chargé');
  });
});
