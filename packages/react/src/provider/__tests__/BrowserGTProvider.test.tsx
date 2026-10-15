// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEnableI18n,
  useLocale,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';

const mockSetCookieValue = vi.hoisted(() => vi.fn());
const mockGetCookieValue = vi.hoisted(() => vi.fn());
const mockReloadPage = vi.hoisted(() => vi.fn());

vi.mock('../../utils/reloadPage', () => ({ reloadPage: mockReloadPage }));

vi.mock('@generaltranslation/react-core/pure', () => ({
  defaultResetLocaleCookieName: 'generaltranslation.locale-reset',
  getI18nConfig: () => ({
    resolveSupportedLocale: (locale: string) => locale,
    getLocaleCookieName: () => 'generaltranslation.locale',
    getRegionCookieName: () => 'generaltranslation.region',
    getEnableI18nCookieName: () => 'generaltranslation.enable-i18n',
  }),
}));

vi.mock('../../condition-store/cookies', () => ({
  getCookieValue: mockGetCookieValue,
  setCookieValue: mockSetCookieValue,
}));

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

describe('BrowserGTProvider', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mockSetCookieValue.mockClear();
    mockGetCookieValue.mockClear();
    mockReloadPage.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps server props authoritative until a reload supplies new props', async () => {
    const { BrowserGTProvider } = await import('../BrowserGTProvider');
    const reload = vi.fn();
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    let setLocale: ReturnType<typeof useSetLocale>;
    let setRegion: ReturnType<typeof useSetRegion>;
    let setEnableI18n: ReturnType<typeof useSetEnableI18n>;

    function Conditions() {
      const locale = useLocale();
      const region = useRegion();
      const enableI18n = useEnableI18n();
      setLocale = useSetLocale();
      setRegion = useSetRegion();
      setEnableI18n = useSetEnableI18n();
      return <span>{`${locale}:${region}:${enableI18n}`}</span>;
    }

    function render(locale: string, region = 'CA', enableI18n = true) {
      root.render(
        <BrowserGTProvider
          locale={locale}
          region={region}
          enableI18n={enableI18n}
          translations={{ [locale]: {} }}
          dictionaries={{}}
          _reload={reload}
        >
          <Conditions />
        </BrowserGTProvider>
      );
    }

    await act(async () => render('fr'));
    expect(element.textContent).toBe('fr:CA:true');
    expect(mockGetCookieValue).not.toHaveBeenCalled();
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.locale',
      value: 'fr',
    });

    await act(async () => setLocale('es'));
    expect(element.textContent).toBe('fr:CA:true');
    expect(reload).toHaveBeenCalledWith({
      locale: 'es',
      region: 'CA',
      enableI18n: true,
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.locale-reset',
      value: 'true',
    });

    await act(async () => render('fr'));
    expect(element.textContent).toBe('fr:CA:true');

    await act(async () => render('de'));
    expect(element.textContent).toBe('de:CA:true');
    expect(mockGetCookieValue).not.toHaveBeenCalled();

    await act(async () => setRegion('MX'));
    expect(element.textContent).toBe('de:CA:true');
    expect(reload).toHaveBeenLastCalledWith({
      locale: 'de',
      region: 'MX',
      enableI18n: true,
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.region',
      value: 'MX',
    });

    await act(async () => setEnableI18n(false));
    expect(element.textContent).toBe('de:CA:true');
    expect(reload).toHaveBeenLastCalledWith({
      locale: 'de',
      region: 'CA',
      enableI18n: false,
    });
    expect(mockSetCookieValue).toHaveBeenCalledWith({
      cookieName: 'generaltranslation.enable-i18n',
      value: 'false',
    });

    await act(async () => render('de', 'MX', false));
    expect(element.textContent).toBe('de:MX:false');
    expect(reload).toHaveBeenCalledTimes(3);

    await act(async () => root.unmount());
  });

  describe('on a page restored from history', () => {
    function mockNavigationType(type: NavigationTimingType) {
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        { type } as PerformanceNavigationTiming,
      ]);
    }

    async function mount(locale: string, reload = vi.fn()) {
      const { BrowserGTProvider } = await import('../BrowserGTProvider');
      const element = document.createElement('div');
      document.body.append(element);
      const root = createRoot(element);
      const render = (nextLocale: string) =>
        root.render(
          <BrowserGTProvider
            locale={nextLocale}
            translations={{ [nextLocale]: {} }}
            dictionaries={{}}
            _reload={reload}
          >
            <span />
          </BrowserGTProvider>
        );
      await act(async () => render(locale));
      return { reload, render, root };
    }

    const localeCookieWrites = () =>
      mockSetCookieValue.mock.calls.filter(
        ([{ cookieName }]) => cookieName === 'generaltranslation.locale'
      );

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('reloads its URL instead of overwriting a newer locale choice', async () => {
      mockNavigationType('back_forward');
      mockGetCookieValue.mockReturnValue('fr');

      const { reload, render, root } = await mount('en');
      // The server decides between the cookie and any locale in the URL, so a
      // router's locale navigation would turn Back into a redirect.
      expect(mockReloadPage).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(localeCookieWrites()).toEqual([]);

      // Rerenders before the page unloads neither write nor reload again.
      await act(async () => render('en'));
      await act(async () => render('fr'));
      expect(mockReloadPage).toHaveBeenCalledTimes(1);
      expect(localeCookieWrites()).toEqual([]);

      await act(async () => root.unmount());
    });

    it('writes the locale when the cookie already matches it', async () => {
      mockNavigationType('back_forward');
      mockGetCookieValue.mockReturnValue('en');

      const { root } = await mount('en');
      expect(mockReloadPage).not.toHaveBeenCalled();
      expect(localeCookieWrites()).toEqual([
        [{ cookieName: 'generaltranslation.locale', value: 'en' }],
      ]);

      await act(async () => root.unmount());
    });

    it('keeps writing the rendered locale after other navigations', async () => {
      mockNavigationType('navigate');
      mockGetCookieValue.mockReturnValue('fr');

      const { root } = await mount('en');
      expect(mockReloadPage).not.toHaveBeenCalled();
      expect(mockGetCookieValue).not.toHaveBeenCalled();
      expect(localeCookieWrites()).toEqual([
        [{ cookieName: 'generaltranslation.locale', value: 'en' }],
      ]);

      await act(async () => root.unmount());
    });
  });
});
