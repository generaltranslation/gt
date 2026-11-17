// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GtInternalPrecomputedJsx,
  GtInternalPrecomputedText,
  InternalGTProvider,
  Num,
  T,
} from '@generaltranslation/react-core/components';
import { useGT } from '@generaltranslation/react-core/hooks';
import {
  I18nStore,
  initializeI18nConfig,
  setI18nStore,
  setReactI18nCache,
  type ReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { createOrUpdateBrowserConditionStore } from '../../condition-store/createBrowserConditionStore';

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
}

describe('a client-rendered app without a provider', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setReactI18nCache({
      lookupTranslation: () => 'Bonjour',
    } as unknown as ReactI18nCache);
    createOrUpdateBrowserConditionStore({ locale: 'fr', _reload: () => {} });
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    resetGTGlobals();
    vi.unstubAllGlobals();
  });

  it('subscribes a <T> once while its props stay the same', async () => {
    const i18nStore = new I18nStore();
    const subscribe = vi.spyOn(i18nStore, 'subscribeToTranslate');
    setI18nStore(i18nStore);
    let rerender!: () => void;

    function App() {
      const [count, setCount] = useState(0);
      rerender = () => setCount(count + 1);
      return (
        <p data-count={count}>
          <T context='greeting'>Hello</T>
        </p>
      );
    }

    await act(async () => root.render(<App />));
    await act(async () => rerender());
    await act(async () => rerender());

    expect(container.innerHTML).toBe('<p data-count="2">Bonjour</p>');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps the function from useGT() between renders', async () => {
    setI18nStore(new I18nStore());
    const functions = new Set<unknown>();
    let rerender!: () => void;

    function App() {
      const [count, setCount] = useState(0);
      rerender = () => setCount(count + 1);
      functions.add(useGT());
      return count;
    }

    await act(async () => root.render(<App />));
    await act(async () => rerender());

    expect(container.innerHTML).toBe('1');
    expect(functions.size).toBe(1);
  });
});

// InternalGTProvider keeps the React context it read at import time.
const gtContext = Reflect.get(globalThis, '__generaltranslation')?.reactCore
  ?.gtContext;

function resetGTGlobalsKeepingContext() {
  Reflect.set(globalThis, '__generaltranslation', {
    reactCore: { gtContext },
  });
}

describe('a <T> the compiler precomputed', () => {
  const HASH = 'abc123';
  const lookupTranslation = vi.fn();
  let root: Root;
  let container: HTMLDivElement;

  // <T>Hello <b className={cls}>big <Num>{n}</Num></b> world</T>
  const source = [
    'Hello ',
    { i: 1, x: 0, c: ['big ', { k: '_gt_n_2', x: 1 }] },
    ' world',
  ];
  const slots = (n: number) => [<b className='x' />, <Num>{n}</Num>];
  const translated = [
    { i: 1, c: [{ k: '_gt_n_2', i: 2, v: 'n' }, ' grand'] },
    ' monde, bonjour',
  ];

  function setup(
    strategy: 'SPA' | 'server-render',
    locale = 'fr',
    enableI18n = true
  ) {
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      strategy
    );
    setReactI18nCache({
      lookupTranslation,
      updateTranslations: () => {},
    } as unknown as ReactI18nCache);
    setI18nStore(new I18nStore());
    createOrUpdateBrowserConditionStore({
      locale,
      enableI18n,
      _reload: () => {},
    });
  }

  beforeEach(() => {
    resetGTGlobalsKeepingContext();
    lookupTranslation.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    // React's development build asks for keys on the arrays these render;
    // the compiler precomputes only production builds, which do not check.
    vi.spyOn(console, 'error').mockImplementation((message) => {
      if (!String(message).includes('unique "key" prop')) {
        throw new Error(String(message));
      }
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    resetGTGlobals();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('looks text up by its hash, without a provider', async () => {
    setup('SPA');
    lookupTranslation.mockReturnValue('Bonjour');

    await act(async () =>
      root.render(<GtInternalPrecomputedText h={HASH} s='Hello' />)
    );

    expect(container.innerHTML).toBe('Bonjour');
    expect(lookupTranslation).toHaveBeenCalledWith('fr', 'Hello', {
      $format: 'JSX',
      $_hash: HASH,
    });
  });

  it.each([
    ['the translation is missing', 'fr', true],
    ['the locale is the default locale', 'en', true],
    ['i18n is disabled', 'fr', false],
  ])('renders the source when %s', async (_name, locale, enableI18n) => {
    setup('SPA', locale, enableI18n);

    await act(async () =>
      root.render(
        <>
          <GtInternalPrecomputedText h={HASH} s='Hello' />
          <GtInternalPrecomputedJsx h={HASH} s={source} v={slots(1234.5)} />
        </>
      )
    );

    expect(container.innerHTML).toBe(
      'HelloHello <b class="x">big 1,234.5</b> world'
    );
    expect(lookupTranslation).toHaveBeenCalledTimes(
      locale === 'fr' && enableI18n ? 2 : 0
    );
  });

  it('renders a translation over the slots of this render', async () => {
    setup('SPA');
    lookupTranslation.mockReturnValue(translated);

    await act(async () =>
      root.render(
        <GtInternalPrecomputedJsx h={HASH} s={source} v={slots(1234.5)} />
      )
    );
    expect(container.innerHTML).toBe(
      '<b class="x">1\u202f234,5 grand</b> monde, bonjour'
    );

    await act(async () =>
      root.render(<GtInternalPrecomputedJsx h={HASH} s={source} v={slots(2)} />)
    );
    expect(container.innerHTML).toBe('<b class="x">2 grand</b> monde, bonjour');
  });

  it('prefers a translation embedded at the call site', async () => {
    setup('SPA');
    lookupTranslation.mockReturnValue('Bonjour du catalogue');
    const inline = vi.fn((locale: string) =>
      locale === 'fr' ? 'Bonjour intégré' : undefined
    );

    await act(async () =>
      root.render(<GtInternalPrecomputedText h={HASH} s='Hello' i={inline} />)
    );

    expect(container.innerHTML).toBe('Bonjour intégré');
    expect(inline).toHaveBeenCalledWith('fr');
  });

  it('follows the locale and translations of a provider', async () => {
    setup('server-render');
    const App = ({
      locale,
      translations,
    }: {
      locale: string;
      translations: Record<string, Record<string, unknown>>;
    }) => (
      <InternalGTProvider
        translations={translations as never}
        locale={locale}
        region={undefined}
        enableI18n
        setLocale={() => {}}
        setRegion={() => {}}
        setEnableI18n={() => {}}
        i18nStore={new I18nStore()}
      >
        <GtInternalPrecomputedText h={HASH} s='Hello' />
        <GtInternalPrecomputedJsx h='def456' s={source} v={slots(1)} />
      </InternalGTProvider>
    );
    const fr = { [HASH]: 'Bonjour', def456: translated };

    await act(async () =>
      root.render(<App locale='fr' translations={{ fr }} />)
    );
    expect(container.innerHTML).toBe(
      'Bonjour<b class="x">1 grand</b> monde, bonjour'
    );
    expect(lookupTranslation).not.toHaveBeenCalled();

    // The translations of a locale are replaced
    await act(async () =>
      root.render(
        <App locale='fr' translations={{ fr: { ...fr, [HASH]: 'Salut' } }} />
      )
    );
    expect(container.innerHTML).toBe(
      'Salut<b class="x">1 grand</b> monde, bonjour'
    );

    // The locale changes to one with a translation, then to one without
    await act(async () =>
      root.render(
        <App locale='de' translations={{ fr, de: { [HASH]: 'Hallo' } }} />
      )
    );
    expect(container.innerHTML).toBe('HalloHello <b class="x">big 1</b> world');
    expect(lookupTranslation).toHaveBeenCalledWith(
      'de',
      source,
      expect.objectContaining({ $_hash: 'def456' })
    );

    await act(async () =>
      root.render(<App locale='en' translations={{ fr }} />)
    );
    expect(container.innerHTML).toBe('HelloHello <b class="x">big 1</b> world');
  });
});
