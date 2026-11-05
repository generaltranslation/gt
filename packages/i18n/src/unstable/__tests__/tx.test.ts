import { hashSource } from 'generaltranslation/id';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { createTx, dyn, tx } from '../../unstable-internal';
import { n, part, plural } from '../placeholders';

const translateMany = vi.fn();
vi.mock(
  '../../i18n-cache/translations-manager/utils/createTranslateMany',
  () => ({ createTranslateManyFactory: () => () => translateMany })
);

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveHash = hashSource({ source: ['Save'], dataFormat: 'ICU_TREE' });
const greetingTree = ['Hello, ', ['name'], '!'];
const greetingHash = hashSource({
  source: greetingTree,
  dataFormat: 'ICU_TREE',
});

function setup({ enableI18n = true } = {}) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    projectId: 'project-id',
  });
  setI18nCache(
    new I18nCache({
      loadTranslations: async (locale: string) =>
        locale === 'fr' ? { [saveHash]: ['Enregistrer'] } : {},
    })
  );
  setWritableConditionStore({
    getLocale: () => 'fr',
    getEnableI18n: () => enableI18n,
  });
}

describe('gt-i18n/unstable tx', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    translateMany.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  it('renders a catalog translation without a runtime request', async () => {
    setup();

    const result = tx`Save`;

    expectTypeOf(result).toEqualTypeOf<Promise<string>>();
    expect(await result).toBe('Enregistrer');
    expect(translateMany).not.toHaveBeenCalled();
  });

  it('translates a miss at runtime and renders it with the values', async () => {
    setup();
    translateMany.mockResolvedValue({
      [greetingHash]: {
        success: true,
        translation: ['Bonjour, ', ['name'], ' !'],
      },
    });

    const name = 'Bo';
    expect(await tx`Hello, ${{ name }}!`).toBe('Bonjour, Bo !');
    expect(translateMany).toHaveBeenCalledWith({
      [greetingHash]: {
        source: greetingTree,
        metadata: expect.objectContaining({
          hash: greetingHash,
          dataFormat: 'ICU_TREE',
        }),
      },
    });
  });

  it('sends the options form with its context hash', async () => {
    setup();
    const hash = hashSource({
      source: ['Save'],
      dataFormat: 'ICU_TREE',
      context: 'button',
    });
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: ['Sauvegarder'] },
    });

    expect(await tx({ context: 'button' })`Save`).toBe('Sauvegarder');
    expect(translateMany).toHaveBeenCalledWith({
      [hash]: {
        source: ['Save'],
        metadata: expect.objectContaining({ hash, context: 'button' }),
      },
    });
  });

  it('renders the source when i18n is disabled', async () => {
    setup({ enableI18n: false });

    expect(await tx`Save`).toBe('Save');
    expect(translateMany).not.toHaveBeenCalled();
  });

  it('renders the source without a request in the default locale', async () => {
    setup();
    const enTx = createTx(() => ({ locale: 'en', enableI18n: true }));

    expect(await enTx`Hello, ${{ name: 'Bo' }}!`).toBe('Hello, Bo!');
    expect(translateMany).not.toHaveBeenCalled();
  });

  it('renders the source when the runtime request fails in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setup();
    translateMany.mockRejectedValue(new Error('network down'));

    expect(await tx`Hello, ${{ name: 'Bo' }}!`).toBe('Hello, Bo!');
    expect(translateMany).toHaveBeenCalledOnce();
  });

  it('translates dyn() text with the message in one request', async () => {
    setup();
    const tree = ['Good morning, ', ['name'], '!'];
    const hash = hashSource({ source: tree, dataFormat: 'ICU_TREE' });
    translateMany.mockResolvedValue({
      [hash]: { success: true, translation: ['Bonjour, ', ['name'], ' !'] },
    });

    const greeting: string = 'Good morning';
    expect(await tx`${dyn(greeting)}, ${{ name: 'Bo' }}!`).toBe(
      'Bonjour, Bo !'
    );
    expect(translateMany).toHaveBeenCalledOnce();
    expect(translateMany).toHaveBeenCalledWith({
      [hash]: expect.objectContaining({ source: tree }),
    });
  });

  it('translates dyn() text inside plural branches', async () => {
    setup();
    const tree = [
      ['count', 'plural', { one: [0, ' Apple'], other: [0, ' Apples'] }],
    ];
    const hash = hashSource({ source: tree, dataFormat: 'ICU_TREE' });
    translateMany.mockResolvedValue({
      [hash]: {
        success: true,
        translation: [
          ['count', 'plural', { one: [0, ' pomme'], other: [0, ' pommes'] }],
        ],
      },
    });

    const [one, other]: string[] = ['Apple', 'Apples'];
    const count = 2;
    expect(
      await tx`${plural(
        { count },
        { one: part`${n} ${dyn(one)}`, other: part`${n} ${dyn(other)}` }
      )}`
    ).toBe('2 pommes');
    expect(translateMany).toHaveBeenCalledWith({
      [hash]: expect.objectContaining({ source: tree }),
    });
  });

  it('binds to async conditions', async () => {
    setup();
    const asyncTx = createTx(async () => ({ locale: 'fr', enableI18n: true }));

    expect(await asyncTx`Save`).toBe('Enregistrer');
  });
});
