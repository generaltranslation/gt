// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import {
  useEnableI18n,
  useLocale,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import { getCookieValue } from '../../condition-store/cookies';
import { BrowserGTProvider } from '../BrowserGTProvider';

// Keep the real provider/context, isolating only translation-cache work.
vi.mock(
  '@generaltranslation/react-core/components',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@generaltranslation/react-core/components')
    >()),
    I18nStore: class {
      updateTranslations() {}
      updateDictionaries() {}
    },
  })
);

type ServerProps = { locale: string; region?: string; enableI18n: boolean };

let setLocale: ReturnType<typeof useSetLocale>;
let setRegion: ReturnType<typeof useSetRegion>;
let setEnableI18n: ReturnType<typeof useSetEnableI18n>;

function Probe() {
  const [count, setCount] = useState(0);
  setLocale = useSetLocale();
  setRegion = useSetRegion();
  setEnableI18n = useSetEnableI18n();
  return (
    <>
      <output>{`${useLocale()}:${useRegion()}:${useEnableI18n()}`}</output>
      <button onClick={() => setCount(count + 1)}>{count}</button>
    </>
  );
}

function resetI18n() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Keep the React context captured by InternalGTProvider at import time.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

describe('BrowserGTProvider server-provided conditions', () => {
  let root: Root;
  let container: HTMLDivElement;
  const reload = vi.fn();
  const conditions = () => container.querySelector('output')!.textContent;
  const cookie = (name: string) =>
    getCookieValue({ cookieName: `generaltranslation.${name}` });

  beforeEach(() => {
    resetI18n();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es', 'de'],
    });
    container = document.createElement('div');
    root = createRoot(container);
    reload.mockClear();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    resetI18n();
    vi.unstubAllGlobals();
  });

  async function render(props: ServerProps) {
    await act(async () => {
      root.render(
        <BrowserGTProvider
          {...props}
          _reload={reload}
          translations={{}}
          dictionaries={{}}
        >
          <Probe />
        </BrowserGTProvider>
      );
    });
  }

  it('keeps the server locale while pending and after rejection, preserving client state', async () => {
    const snapshot = { locale: 'en', enableI18n: true };
    await render(snapshot);
    await act(async () => setLocale('fr'));
    expect(cookie('locale')).toBe('fr');
    expect(cookie('locale-reset')).toBe('true');
    await act(async () => container.querySelector('button')!.click());
    expect(conditions()).toBe('en:undefined:true');

    await render(snapshot);
    expect(cookie('locale')).toBe('en');
    expect(conditions()).toBe('en:undefined:true');

    await render({ ...snapshot });
    expect(conditions()).toBe('en:undefined:true');
    expect(cookie('locale')).toBe('en');
    expect(container.querySelector('button')!.textContent).toBe('1');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
    });
  });

  it('renders an accepted locale from the new server snapshot', async () => {
    await render({ locale: 'en', enableI18n: true });
    await act(async () => setLocale('fr'));
    expect(conditions()).toBe('en:undefined:true');
    await render({ locale: 'fr', enableI18n: true });
    expect(conditions()).toBe('fr:undefined:true');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('prefers server props over cookies and requests a reload for region and enableI18n changes', async () => {
    document.cookie = 'generaltranslation.locale=es;path=/';
    document.cookie = 'generaltranslation.region=US;path=/';
    document.cookie = 'generaltranslation.enable-i18n=false;path=/';

    await render({ locale: 'de', region: 'CA', enableI18n: true });
    expect(conditions()).toBe('de:CA:true');
    expect(cookie('locale')).toBe('de');
    expect(cookie('region')).toBe('CA');
    expect(cookie('enable-i18n')).toBe('true');

    await act(async () => setRegion('MX'));
    expect(conditions()).toBe('de:CA:true');
    expect(cookie('region')).toBe('MX');
    expect(reload).toHaveBeenLastCalledWith({
      locale: 'de',
      region: 'MX',
      enableI18n: true,
    });

    await act(async () => setEnableI18n(false));
    expect(conditions()).toBe('de:CA:true');
    expect(cookie('enable-i18n')).toBe('false');
    expect(reload).toHaveBeenLastCalledWith({
      locale: 'de',
      region: 'CA',
      enableI18n: false,
    });

    await render({ locale: 'de', region: 'MX', enableI18n: false });
    expect(conditions()).toBe('de:MX:false');
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
