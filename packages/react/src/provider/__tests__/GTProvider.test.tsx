// @vitest-environment jsdom
import { hashSource } from 'generaltranslation/id';
import { act, useEffect } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T } from '@generaltranslation/react-core/components';
import {
  useGT,
  useLocale,
  useRegion,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import {
  getI18nConfig,
  getReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { getCookieValue } from '../../condition-store/cookies';
import { initializeGTSRAClient } from '../../setup/initializeGTSRAClient';
import { GTProvider } from '../GTProvider';
import { ServerGTProvider } from '../ServerGTProvider';

const key = hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' });
const catalogs: Record<string, Record<string, string>> = {
  de: { [key]: 'Speichern' },
  es: { [key]: 'Guardar' },
  fr: { [key]: 'Enregistrer' },
};

let setLocale: ReturnType<typeof useSetLocale>;
let setRegion: ReturnType<typeof useSetRegion>;

function Probe() {
  const t = useGT();
  setLocale = useSetLocale();
  setRegion = useSetRegion();
  return <output>{`${useLocale()}:${useRegion()}:${t`Save`}`}</output>;
}

function Fallback() {
  return (
    <>
      {useLocale()}:<T>Loading</T>
    </>
  );
}

describe('GTProvider without translations', () => {
  let root: Root;
  let container: HTMLDivElement;
  let release: Map<string, () => void>;
  // Loads `de` at once and any other locale when the test releases it.
  const loadTranslations = vi.fn(async (locale: string) => {
    if (locale !== 'de') {
      await new Promise<void>((resolve) => release.set(locale, resolve));
    }
    return catalogs[locale] ?? {};
  });
  const shown = () => container.textContent;
  const savedLocale = () =>
    getCookieValue({ cookieName: 'generaltranslation.locale' });
  const loading = (locale: string) =>
    vi.waitFor(() => expect(release.has(locale)).toBe(true));
  const finish = (locale: string) => act(async () => release.get(locale)!());

  async function render(props: { locale?: string; region?: string } = {}) {
    await act(async () => {
      root.render(
        <GTProvider {...props} fallback={<Fallback />}>
          <Probe />
        </GTProvider>
      );
    });
  }

  beforeEach(() => {
    Reflect.deleteProperty(
      Reflect.get(globalThis, '__generaltranslation'),
      'i18n'
    );
    release = new Map();
    loadTranslations.mockClear();
    initializeGTSRAClient({
      defaultLocale: 'en',
      locales: ['en', 'de', 'es', 'fr'],
      loadTranslations,
    });
    document.cookie = 'generaltranslation.locale=de;path=/';
    document.documentElement.lang = '';
    container = document.createElement('div');
    root = createRoot(container);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;max-age=0;path=/`;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the fallback inside GT, then the visitor’s locale with its translations loaded', async () => {
    act(() => {
      root.render(
        <GTProvider fallback={<Fallback />}>
          <Probe />
        </GTProvider>
      );
    });
    expect(shown()).toBe('de:Loading');

    await act(async () => {});

    expect(shown()).toBe('de:undefined:Speichern');
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('renders the fallback on the server, in the default locale', () => {
    expect(
      renderToString(
        <ServerGTProvider fallback={<Fallback />}>
          <Probe />
        </ServerGTProvider>
      ).replace(/<!-- -->/g, '')
    ).toBe('en:Loading');
  });

  it('hydrates what the server rendered, then turns to what the visitor saved', async () => {
    document.cookie = 'generaltranslation.region=CA;path=/';
    container = document.createElement('div');
    container.innerHTML = renderToString(
      <ServerGTProvider fallback={<Fallback />}>
        <Probe />
      </ServerGTProvider>
    );
    const onRecoverableError = vi.fn();

    await act(async () => {
      root = hydrateRoot(
        container,
        <GTProvider fallback={<Fallback />}>
          <Probe />
        </GTProvider>,
        { onRecoverableError }
      );
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(shown()).toBe('de:CA:Speichern');
  });

  it('hydrates a fallback as source text, whatever the server had cached', async () => {
    function SourceFallback() {
      const t = useGT();
      return `${useLocale()}:${useRegion() ?? 'none'}:${t`Save`}`;
    }
    getReactI18nCache().updateTranslations({ fr: catalogs.fr });
    const provider = (Provider: typeof GTProvider) => (
      <Provider locale='fr' region='' fallback={<SourceFallback />}>
        <Probe />
      </Provider>
    );
    container = document.createElement('div');
    container.innerHTML = renderToString(provider(ServerGTProvider));
    expect(container.textContent).toBe('fr:none:Save');
    const onRecoverableError = vi.fn();

    await act(async () => {
      root = hydrateRoot(container, provider(GTProvider), {
        onRecoverableError,
      });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
  });

  it('leaves the document’s language to the outer provider, from its fallback on', async () => {
    act(() => {
      root.render(
        <GTProvider fallback={<Fallback />}>
          <Probe />
          <GTProvider locale='fr'>
            <i />
          </GTProvider>
        </GTProvider>
      );
    });
    expect(document.documentElement.lang).toBe('de');

    await act(async () => {});
    await loading('fr');
    await finish('fr');

    expect(document.documentElement.lang).toBe('de');
  });

  it('does not warn about a load that fails after the provider has gone', async () => {
    let fail!: (error: Error) => void;
    loadTranslations.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject))
    );
    await render();

    await act(async () => root.render(null));
    await act(async () => fail(new Error('offline')));

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('reads the enableI18n cookie as the browser condition store does', async () => {
    document.cookie = `${getI18nConfig().getEnableI18nCookieName()}=0;path=/`;

    await render();

    expect(shown()).toBe('de:undefined:Save');
  });

  it('changes locale in place, keeping the current one on screen until the next has loaded', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    await render();

    act(() => setLocale('fr'));
    await loading('fr');
    expect(shown()).toBe('de:undefined:Speichern');
    expect(savedLocale()).toBe('de');

    await finish('fr');

    expect(shown()).toBe('fr:undefined:Enregistrer');
    expect(savedLocale()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps the locale on screen when the next one fails to load, and loads it when it is chosen again', async () => {
    await render();
    loadTranslations.mockRejectedValueOnce(new Error('offline'));

    await act(async () => setLocale('fr'));
    expect(shown()).toBe('de:undefined:Speichern');
    expect(savedLocale()).toBe('de');
    expect(console.warn).toHaveBeenCalledOnce();

    act(() => setLocale('fr'));
    await loading('fr');
    await finish('fr');
    expect(shown()).toBe('fr:undefined:Enregistrer');
  });

  it('loads a locale prop again when it is chosen again after failing to load', async () => {
    await render({ locale: 'de' });
    loadTranslations.mockRejectedValueOnce(new Error('offline'));
    await render({ locale: 'fr' });
    expect(shown()).toBe('de:undefined:Speichern');

    act(() => setLocale('fr'));
    await loading('fr');
    await finish('fr');

    expect(shown()).toBe('fr:undefined:Enregistrer');
    expect(savedLocale()).toBe('de');
  });

  it('renders the source when the first locale fails to load', async () => {
    loadTranslations.mockRejectedValueOnce(new Error('offline'));

    await render();

    expect(shown()).toBe('de:undefined:Save');
  });

  it('ends on the locale chosen last when two loads finish out of order', async () => {
    await render();
    act(() => setLocale('fr'));
    await loading('fr');
    act(() => setLocale('es'));
    await loading('es');

    await finish('es');
    await finish('fr');

    expect(shown()).toBe('es:undefined:Guardar');
    expect(savedLocale()).toBe('es');
  });

  it('keeps a locale change that is loading when the region changes', async () => {
    await render();
    act(() => setLocale('fr'));
    await loading('fr');

    act(() => setRegion('CA'));
    expect(shown()).toBe('de:CA:Speichern');
    await finish('fr');

    expect(shown()).toBe('fr:CA:Enregistrer');
  });

  it('changes nothing through a setter kept from before its prop was given', async () => {
    await render();
    const earlierSetRegion = setRegion;
    await render({ region: 'US' });

    await act(async () => earlierSetRegion('CA'));
    expect(shown()).toBe('de:US:Speichern');

    await render();
    expect(shown()).toBe('de:undefined:Speichern');
  });

  it('changes nothing through a setter that a child calls as its prop is given', async () => {
    function SetsRegionOnMount() {
      const setRegionOnMount = useSetRegion();
      useEffect(() => setRegionOnMount('CA'), [setRegionOnMount]);
      return null;
    }
    await render();

    await act(async () => {
      root.render(
        <GTProvider region='US' fallback={<Fallback />}>
          <Probe />
          <SetsRegionOnMount />
        </GTProvider>
      );
    });
    await render();

    expect(shown()).toBe('de:undefined:Speichern');
  });

  it('reads an empty region as none', async () => {
    await render({ region: '' });
    expect(shown()).toBe('de:undefined:Speichern');

    await render();
    await act(async () => setRegion(''));
    expect(shown()).toBe('de:undefined:Speichern');
  });

  it('follows a locale prop, and saves nothing when its setter is called', async () => {
    await render({ locale: 'fr' });
    expect(shown()).toBe('fr:Loading');
    await finish('fr');
    expect(shown()).toBe('fr:undefined:Enregistrer');

    await act(async () => setLocale('es'));
    expect(shown()).toBe('fr:undefined:Enregistrer');
    expect(savedLocale()).toBe('de');

    await render({ locale: 'de' });
    expect(shown()).toBe('de:undefined:Speichern');
  });

  it('tells the app which locale was chosen, which is all a choice does under a locale prop', async () => {
    const onLocaleChange = vi.fn();
    await act(async () => {
      root.render(
        <GTProvider locale='de' onLocaleChange={onLocaleChange}>
          <Probe />
        </GTProvider>
      );
    });

    await act(async () => setLocale('fr-FR'));

    expect(onLocaleChange).toHaveBeenCalledExactlyOnceWith('fr');
    expect(shown()).toBe('de:undefined:Speichern');
  });

  it('renders translations it is given at once, without loading any', async () => {
    await act(async () => {
      root.render(
        <GTProvider locale='fr' translations={{ fr: catalogs.fr }}>
          <Probe />
        </GTProvider>
      );
    });

    expect(shown()).toBe('fr:undefined:Enregistrer');
    expect(loadTranslations).not.toHaveBeenCalled();
  });
});
