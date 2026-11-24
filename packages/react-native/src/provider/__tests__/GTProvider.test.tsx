// @vitest-environment jsdom
import { hashSource } from 'generaltranslation/id';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useGT,
  useLocale,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import {
  defaultEnableI18nCookieName as enableI18nStoreKey,
  defaultLocaleCookieName as localeStoreKey,
  defaultRegionCookieName as regionStoreKey,
} from 'gt-i18n/internal/cookies';

// Native storage that, like Android's, can apply a write some time after it is made.
const native = vi.hoisted(() => ({
  store: new Map<string, string>(),
  pending: [] as (() => void)[],
  late: false,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  TurboModuleRegistry: { getEnforcing: vi.fn(), get: vi.fn() },
  ActivityIndicator: 'progress',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'div',
}));
vi.mock('../../utils/getNativeLocales', () => ({
  getNativeLocales: () => ['de-DE'],
}));
vi.mock('../../utils/nativeStore', () => ({
  nativeStoreGet: (key: string) => native.store.get(key) ?? null,
  nativeStoreSet: (key: string, value: string) => {
    const write = () => native.store.set(key, value);
    if (native.late) native.pending.push(write);
    else write();
  },
}));

const { GTProvider } = await import('../GTProvider');
const { initializeGT } = await import('../../setup/initializeGT');

const key = hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' });
const catalogs: Record<string, Record<string, string>> = {
  de: { [key]: 'Speichern' },
  es: { [key]: 'Guardar' },
  fr: { [key]: 'Enregistrer' },
};

// Locales whose translations wait for the test to release them.
const held = new Map<string, () => void>();
let hold = false;
const loading = (locale: string) =>
  vi.waitFor(() => expect(held.has(locale)).toBe(true));
const loadTranslations = vi.fn(async (locale: string) => {
  if (hold) await new Promise<void>((resolve) => held.set(locale, resolve));
  return catalogs[locale] ?? {};
});

let setLocale: ReturnType<typeof useSetLocale>;
let setRegion: ReturnType<typeof useSetRegion>;
let setEnableI18n: ReturnType<typeof useSetEnableI18n>;

function Probe() {
  const t = useGT();
  setLocale = useSetLocale();
  setRegion = useSetRegion();
  setEnableI18n = useSetEnableI18n();
  return <output>{`${useLocale()}:${useRegion()}:${t`Save`}`}</output>;
}

describe('GTProvider', () => {
  let root: Root;
  let container: HTMLDivElement;
  const shown = () => container.textContent;

  async function render(props: { locale?: string; region?: string } = {}) {
    await act(async () => {
      root.render(
        <GTProvider {...props} fallback='Loading'>
          <Probe />
        </GTProvider>
      );
    });
  }

  beforeEach(() => {
    Reflect.deleteProperty(
      Reflect.get(globalThis, '__generaltranslation') ?? {},
      'i18n'
    );
    native.store.clear();
    native.pending.length = 0;
    native.late = false;
    held.clear();
    hold = false;
    loadTranslations.mockClear();
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'de', 'es', 'fr'],
      loadTranslations,
    });
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts in the saved locale, else the language of the device, behind the fallback', async () => {
    hold = true;
    await render();
    await loading('de');
    expect(shown()).toBe('Loading');
    await act(async () => held.get('de')!());
    expect(shown()).toBe('de:undefined:Speichern');

    native.store.set(localeStoreKey, 'fr');
    hold = false;
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    expect(shown()).toBe('fr:undefined:Enregistrer');
  });

  it('changes locale at once and saves it, though native storage writes late', async () => {
    native.late = true;
    await render();

    await act(async () => setLocale('fr'));
    expect(shown()).toBe('fr:undefined:Enregistrer');

    native.pending.forEach((write) => write());
    expect(native.store.get(localeStoreKey)).toBe('fr');
  });

  it.each([
    ['its setter', () => act(async () => setLocale('fr'))],
    ['the locale prop', () => render({ locale: 'fr' })],
  ])(
    'keeps the current locale on screen while a change through %s loads',
    async (_, change) => {
      await render();
      hold = true;

      await change();
      await loading('fr');
      expect(shown()).toBe('de:undefined:Speichern');

      await act(async () => held.get('fr')!());
      expect(shown()).toBe('fr:undefined:Enregistrer');
    }
  );

  it('keeps the locale on screen when the next one fails to load, and loads it when it is chosen again', async () => {
    await render();
    loadTranslations.mockRejectedValueOnce(new Error('offline'));

    await act(async () => setLocale('fr'));
    expect(shown()).toBe('de:undefined:Speichern');
    expect(native.store.has(localeStoreKey)).toBe(false);

    await act(async () => setLocale('fr'));
    expect(shown()).toBe('fr:undefined:Enregistrer');
  });

  it('renders the locale prop whatever its setter is given, and saves nothing', async () => {
    await render({ locale: 'de' });

    await act(async () => setLocale('fr'));

    expect(shown()).toBe('de:undefined:Speichern');
    expect(native.store.has(localeStoreKey)).toBe(false);
  });

  it('lets a setter kept from an earlier render change only its own condition', async () => {
    await render();
    const earlierSetRegion = setRegion;
    await act(async () => setLocale('fr'));
    await act(async () => setLocale('es'));

    await act(async () => earlierSetRegion('CA'));

    expect(shown()).toBe('es:CA:Guardar');
  });

  it('keeps a region cleared when native storage writes late', async () => {
    native.store.set(regionStoreKey, 'US');
    await render();
    expect(shown()).toBe('de:US:Speichern');
    native.late = true;

    await act(async () => setRegion(undefined));
    expect(shown()).toBe('de:undefined:Speichern');

    native.pending.forEach((write) => write());
    expect(native.store.get(regionStoreKey)).toBe('');
  });

  it('saves that translation is off, and starts that way the next time', async () => {
    await render();

    await act(async () => setEnableI18n(false));
    expect(native.store.get(enableI18nStoreKey)).toBe('false');

    await act(async () => root.render(null));
    await render();
    expect(shown()).toBe('de:undefined:Save');
  });

  it('keeps a region cleared after a region prop has come and gone', async () => {
    native.store.set(regionStoreKey, 'US');
    await render();

    await act(async () => setRegion(''));
    expect(shown()).toBe('de:undefined:Speichern');

    await render({ region: 'CA' });
    await render();
    expect(shown()).toBe('de:undefined:Speichern');
    expect(native.store.get(regionStoreKey)).toBe('');
  });
});
