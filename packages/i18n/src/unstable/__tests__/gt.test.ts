import { formatCutoff } from '@generaltranslation/format';
import type { MessageFormatElement } from '@generaltranslation/icu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { t } from '../../unstable';
import { buildMessage } from '../buildMessage';
import { createGT, getGT } from '../gt';
import { date, derive, n, number, part, plural, select } from '../placeholders';
import { hashMessage, type MessageTreeMetadata } from '../renderMessage';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

/** Catalog key of a source template, computed the way gt does. */
function keyOf(metadata: MessageTreeMetadata = {}) {
  return (strings: TemplateStringsArray, ...holes: unknown[]) =>
    hashMessage(buildMessage(strings, holes).tree, metadata);
}

const literal = (value: string): MessageFormatElement => ({
  type: 0,
  value,
});
const argument = (value: string): MessageFormatElement => ({
  type: 1,
  value,
});

function setup({
  locale = 'fr',
  enableI18n = true,
  fr = {},
  cacheExpiryTime,
}: {
  locale?: string;
  enableI18n?: boolean;
  fr?: Record<string, unknown>;
  cacheExpiryTime?: number;
} = {}) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
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
      fr: { [keyOf({ context: 'button' })`Save`]: [literal('Enregistrer')] },
    });
    expect(gt({ context: 'button' })`Save`).toBe('Enregistrer');
    expect(gt`Save`).toBe('Save');
  });

  it('honors the locale option', async () => {
    const fr = { [keyOf()`Save`]: [literal('Enregistrer')] };
    const gt = await setup({ locale: 'en', fr });
    await getGT({ locale: 'fr', enableI18n: true });
    expect(gt`Save`).toBe('Save');
    expect(gt({ locale: 'fr' })`Save`).toBe('Enregistrer');
  });

  it('renders the source on a miss', async () => {
    const gt = await setup();
    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the source when i18n is disabled', async () => {
    const gt = await setup({
      enableI18n: false,
      fr: { [keyOf()`Save`]: [literal('Enregistrer')] },
    });
    expect(gt`Save`).toBe('Save');
    expect(gt({ locale: 'fr' })`Save`).toBe('Save');
    expect(t`Save`).toBe('Save');
  });

  it('treats a cached value that is not a tree as a miss and warns once', async () => {
    const gt = await setup({
      fr: {
        [keyOf()`Malformed`]: 'Mal formé',
        [keyOf()`Bad type`]: [{ type: 42, value: 'x' }],
      },
    });
    expect(gt`Malformed`).toBe('Malformed');
    expect(gt`Malformed`).toBe('Malformed');
    expect(gt`Bad type`).toBe('Bad type');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('treats a malformed nested branch as a miss', async () => {
    const tree = [
      {
        type: 5,
        value: 'role',
        options: { other: { value: [{ type: 1, value: ['x'] }] } },
      },
    ];
    const gt = await setup({ fr: { [keyOf()`Invalid`]: tree } });
    expect(gt`Invalid`).toBe('Invalid');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('treats a tree nested beyond the depth bound as a miss', async () => {
    let tree: unknown[] = [literal('deep')];
    for (let depth = 0; depth < 100; depth++) {
      tree = [{ type: 5, value: 'role', options: { other: { value: tree } } }];
    }
    const gt = await setup({ fr: { [keyOf()`Deep`]: tree } });
    expect(gt`Deep`).toBe('Deep');
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('keeps getGT translations when cacheExpiryTime is 0', async () => {
    const gt = await setup({
      cacheExpiryTime: 0,
      fr: { [keyOf()`Save`]: [literal('Enregistrer')] },
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
        fr: { [keyOf()`Save`]: [literal('Enregistrer')] },
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
      [`fr:${keyOf()`Save`}`]: [literal('Enregistrer')],
      [`fr:${keyOf()`Cancel`}`]: [{ type: 0 }],
    };
    const lookupTranslation = (locale: string, hash: string) =>
      snapshot[`${locale}:${hash}`];
    const gt = createGT({ getLocale: () => 'fr', lookupTranslation });
    expect(gt`Save`).toBe('Enregistrer');
    expect(gt`Cancel`).toBe('Cancel');
    expect(warn.mock.calls[0][0]).toContain('is not a message tree');
  });

  it('skips a custom lookupTranslation when i18n is disabled', async () => {
    await setup({ locale: 'en' });
    const lookupTranslation = vi.fn(() => [literal('Replaced')]);
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
      'gt-i18n Error: The gt template placeholder "name" is bound to different values'
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
        [keyOf({ maxChars: 12 })`Read more about pricing`]: [
          literal(translated),
        ],
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
      gt`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', member: 'members' })}, ${number(0.5, { style: 'percent' })} done by ${date(new Date(Date.UTC(2024, 0, 2)), { timeZone: 'UTC', dateStyle: 'medium' })}`
    ).toBe('2 files for admins, 50% done by Jan 2, 2024');
  });

  it('formats a translated plural in the target locale', async () => {
    const count = 2;
    const gt = await setup({
      fr: {
        [keyOf()`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`]:
          [
            {
              type: 6,
              value: 'count',
              offset: 0,
              pluralType: 'cardinal',
              options: {
                one: { value: [{ type: 7 }, literal(' article')] },
                other: { value: [{ type: 7 }, literal(' articles')] },
              },
            },
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
        [keyOf()`Welcome back!`]: [literal('Bon retour !')],
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
    const dateOptions: Intl.DateTimeFormatOptions = {
      dateStyle: 'medium',
      timeZone: 'UTC',
    };
    const gt = await setup({
      fr: {
        [keyOf()`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`]:
          [
            literal('Total : '),
            {
              type: 2,
              value: 'price',
              style: {
                type: 0,
                tokens: [],
                parsedOptions: { style: 'currency', currency: 'USD' },
              },
            },
          ],
      },
    });
    expect(
      gt`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`
    ).toBe(
      `Total : ${new Intl.NumberFormat('fr', { style: 'currency', currency: 'USD' }).format(price)}`
    );
    // A miss formats the source in the source locale.
    expect(gt`Due ${date({ due }, dateOptions)}`).toBe(
      `Due ${new Intl.DateTimeFormat('en', dateOptions).format(due)}`
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
      'gt-i18n Error: A gt template placeholder is not a value, a named variable, or a helper'
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
