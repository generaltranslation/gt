import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { msg as legacyMsg } from '../../translation-functions/msg/msg';
import { mFallback, msg, type Msg } from '../../unstable';
import { createMessages, getMessages } from '../../unstable-internal';
import { buildMessage } from '../buildMessage';
import { getGT } from '../gt';
import { date, number, part, plural, select } from '../placeholders';
import { n } from '../placeholders';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function keyOf(strings: TemplateStringsArray, ...holes: unknown[]) {
  return hashSource({
    source: buildMessage(strings, holes).tree,
    dataFormat: 'ICU_TREE',
  });
}

function setup(fr: Record<string, unknown> = {}, locale = 'fr') {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
  setI18nCache(
    new I18nCache({
      loadTranslations: vi.fn(async (requested: string) =>
        requested === 'fr' ? fr : {}
      ),
    })
  );
  setWritableConditionStore({
    getLocale: () => locale,
    getEnableI18n: () => true,
  });
  return getMessages({ locale, enableI18n: true });
}

const name = 'Ada';

describe('gt-i18n/unstable msg', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  it('returns literal strings and templates without values unchanged', () => {
    const save: 'Save' = msg('Save');
    expect(save).toBe('Save');
    expect(msg`Save`).toBe('Save');
  });

  it('translates a plain string as literal text with the hash of gt', async () => {
    const m = await setup({ [keyOf`Save`]: ['Enregistrer'] });
    const gt = await getGT({ locale: 'fr', enableI18n: true });
    expect(m(msg('Save'))).toBe('Enregistrer');
    expect(gt`Save`).toBe('Enregistrer');
  });

  it('keeps { # and quotes in a plain string as text', async () => {
    const text = "It's {name} #1";
    const m = await setup({ [keyOf`It's {name} #1`]: ["C'est {name} n°1"] });
    expect(m(text)).toBe("C'est {name} n°1");
    expect(mFallback(text)).toBe(text);
    expect(m('')).toBe('');
  });

  it('returns null and undefined unchanged', async () => {
    const m = await setup();
    expect(m(null)).toBeNull();
    expect(m(undefined)).toBeUndefined();
    expect(mFallback(null)).toBeNull();
  });

  it('returns a template with values as a Msg and renders it through m', async () => {
    const m = await setup({
      [keyOf`Hello, ${{ name }}!`]: ['Bonjour, ', ['name'], ' !'],
    });
    const greeting = msg`Hello, ${{ name }}!`;
    expect(greeting).toEqual({
      tree: ['Hello, ', ['name'], '!'],
      values: { name: 'Ada' },
      formats: {},
      $_hash: keyOf`Hello, ${{ name }}!`,
    });
    // React only passes plain objects from server to client components.
    expect(Object.getPrototypeOf((greeting as Msg).values)).toBe(
      Object.prototype
    );
    expect(m(greeting)).toBe('Bonjour, Ada !');
    expect(m(greeting, { name: 'Bo' })).toBe('Bonjour, Bo !');
    expect(mFallback(greeting)).toBe('Hello, Ada!');
    expect(mFallback(greeting, { name: 'Bo' })).toBe('Hello, Bo!');
  });

  it('returns a Msg for a template with options', async () => {
    const m = await setup({
      [hashSource({
        source: ['Save'],
        dataFormat: 'ICU_TREE',
        context: 'button',
      })]: ['Enregistrer'],
    });
    const save = msg({ context: 'button' })`Save`;
    expect(save).toMatchObject({ tree: ['Save'], context: 'button' });
    expect(mFallback(save)).toBe('Save');
    expect(m(save)).toBe('Enregistrer');
    expect(m(msg('Save'))).toBe('Save');
  });

  it('reads the same with and without a compiler-injected $_hash', async () => {
    const saveHash = hashSource({ source: ['Save'], dataFormat: 'ICU_TREE' });
    const m = await setup({
      [saveHash]: ['Enregistrer'],
      injected: ['Bonjour, ', ['name']],
    });
    // The compiler rewrites msg`Save` to msg({ $_hash })`Save`.
    const compiled = msg({ $_hash: saveHash } as never)`Save`;
    expect(compiled).toBe('Save');
    expect(m(compiled)).toBe('Enregistrer');

    const name = 'Ada';
    const greeting = msg({ $_hash: 'injected' } as never)`Hello, ${{ name }}`;
    expect(m(greeting)).toBe('Bonjour, Ada');
  });

  it('keeps dates, bigints, non-finite numbers and undefined as captured', async () => {
    const m = await setup();
    const due = new Date(Date.UTC(2024, 0, 15));
    const nickname = undefined;
    const message = msg`Due ${date({ due }, { style: 'medium', timeZone: 'UTC' })}, ${number({ id: 12n })}, ${{ ratio: NaN }}, ${plural(Infinity, { other: part`${n} left` })}, hi ${{ nickname }}`;
    const expected = 'Due Jan 15, 2024, 12, NaN, ∞ left, hi ';
    expect((message as Msg).values).toEqual({
      due,
      id: 12n,
      ratio: NaN,
      _gt_1: Infinity,
      nickname: undefined,
    });
    // The time zone is formatting context: kept beside the tree, not in it.
    expect((message as Msg).formats).toEqual({ due: { timeZone: 'UTC' } });
    expect((message as Msg).tree).toContainEqual(['due', 'date', 'medium']);
    expect(m(message)).toBe(expected);
    expect(mFallback(message)).toBe(expected);
  });

  it('renders select and plural branches from the tree', async () => {
    const m = await setup();
    const role = 'admin' as 'admin' | 'member';
    const message = msg`${select({ role }, { admin: 'Admin', member: 'Member' })}: ${plural({ count: 2 }, { one: 'one', other: part`${n} items` })}`;
    expect(m(message)).toBe('Admin: 2 items');
    expect(m(message, { role: 'member', count: 1 })).toBe('Member: one');
  });

  it('renders any string, including legacy msg output, as literal text', async () => {
    const m = await setup();
    const legacy = legacyMsg('Hello, {name}', { name });
    for (const message of ['Time: 12:30', legacy]) {
      expect(m(message)).toBe(message);
      expect(mFallback(message)).toBe(message);
    }
  });

  it('throws for an object that is not a Msg', async () => {
    const m = await setup();
    const invalid = [
      {},
      { tree: ['Hi'], values: {} },
      { tree: [['x', 'bogus']], values: {}, $_hash: 'h' },
      { tree: ['Hi'], $_hash: 'h' },
      { tree: [['name']], values: {}, $_hash: 'h' },
      { tree: ['Hi'], values: {}, formats: {}, $_hash: 'h', maxChars: 'ten' },
    ];
    for (const message of invalid) {
      expect(() => m(message as Msg)).toThrow('not a message from msg()');
      expect(() => mFallback(message as Msg)).toThrow(
        'not a message from msg()'
      );
    }
  });

  it('keeps an undefined value, so it renders as nothing', async () => {
    const m = await setup();
    const who = undefined;
    expect(m(msg`Hi ${{ who }}!`)).toBe('Hi !');
  });

  it('renders an undefined value dropped by serialization as nothing', async () => {
    const m = await setup();
    const who = undefined;
    // React Flight, like JSON, drops undefined-valued keys.
    const sent = JSON.parse(JSON.stringify(msg`Hi ${{ who }}!`)) as Msg;
    expect(sent.values).toEqual({});
    expect(m(sent)).toBe('Hi !');
    expect(mFallback(sent)).toBe('Hi !');
  });

  it('renders the source when a translation uses a variable the message lacks', async () => {
    const m = await setup({
      [keyOf`Hello, ${{ name }}!`]: ['Bonjour, ', ['nom'], ' !'],
    });
    expect(m(msg`Hello, ${{ name }}!`)).toBe('Hello, Ada!');
    expect(warn).toHaveBeenCalled();
  });

  it('createMessages reads a custom lookupTranslation', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    const lookupTranslation = vi.fn(() => ['Enregistrer']);
    const m = createMessages({ getLocale: () => 'fr', lookupTranslation });
    expect(m(msg('Save'))).toBe('Enregistrer');
    expect(lookupTranslation).toHaveBeenCalledWith(
      ['Save'],
      expect.objectContaining({ $locale: 'fr', $_hash: keyOf`Save` })
    );
  });
});
