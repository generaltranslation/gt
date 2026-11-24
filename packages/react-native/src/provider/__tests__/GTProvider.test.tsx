// @vitest-environment jsdom
import { hashSource } from 'generaltranslation/id';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEnableI18n,
  useGT,
  useLocale,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import { defaultRegionCookieName as regionStoreKey } from 'gt-i18n/internal/cookies';

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
  getNativeLocales: () => ['de'],
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

let setLocale: ReturnType<typeof useSetLocale>;
let setRegion: ReturnType<typeof useSetRegion>;
let setEnableI18n: ReturnType<typeof useSetEnableI18n>;

function Probe() {
  const t = useGT();
  setLocale = useSetLocale();
  setRegion = useSetRegion();
  setEnableI18n = useSetEnableI18n();
  return (
    <output>{`${useLocale()}:${useRegion()}:${useEnableI18n()}:${t`Save`}`}</output>
  );
}

describe('GTProvider', () => {
  let root: Root;
  let container: HTMLDivElement;
  const shown = () => container.querySelector('output')?.textContent;

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
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'de', 'es', 'fr'],
      loadTranslations: async (locale: string) => catalogs[locale] ?? {},
    });
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it('changes locale at once while native storage has not yet written it', async () => {
    native.late = true;
    await render();
    expect(shown()).toBe('de:undefined:true:Speichern');

    await act(async () => setLocale('fr'));

    expect(shown()).toBe('fr:undefined:true:Enregistrer');
  });

  it('lets a setter kept from an earlier render change only its own condition', async () => {
    await render();
    const earlierSetRegion = setRegion;
    await act(async () => setLocale('fr'));
    await act(async () => setLocale('es'));

    await act(async () => earlierSetRegion('CA'));

    expect(shown()).toBe('es:CA:true:Guardar');
  });

  it('renders the locale prop whatever the setters are given', async () => {
    await render({ locale: 'de' });

    await act(async () => setLocale('fr'));
    expect(shown()).toBe('de:undefined:true:Speichern');

    await act(async () => setEnableI18n(false));
    expect(shown()).toBe('de:undefined:false:Save');
  });

  it('keeps a region cleared when native storage writes late', async () => {
    native.store.set(regionStoreKey, 'US');
    await render();
    expect(shown()).toBe('de:US:true:Speichern');
    native.late = true;

    await act(async () => setRegion(undefined));
    expect(shown()).toBe('de:undefined:true:Speichern');

    native.pending.forEach((write) => write());
    expect(native.store.get(regionStoreKey)).toBe('');
  });

  it('keeps a region cleared after a region prop has come and gone', async () => {
    native.store.set(regionStoreKey, 'US');
    await render();

    await act(async () => setRegion(''));
    expect(shown()).toBe('de:undefined:true:Speichern');

    await render({ region: 'CA' });
    await render();
    expect(shown()).toBe('de:undefined:true:Speichern');
    expect(native.store.get(regionStoreKey)).toBe('');
  });
});
