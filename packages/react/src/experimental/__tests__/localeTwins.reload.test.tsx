// @vitest-environment jsdom
/**
 * A locale twin client must load a new document after a locale switch so that
 * only the new locale's twins load. A custom soft `_reload` may run, but it
 * cannot replace the document reload; a navigating one (marked with
 * `markNavigatingReload`) can.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { useSetLocale } from '@generaltranslation/react-core/hooks';
import {
  GtInternalRegisterLocaleTwin,
  initializeLocaleTwins,
  markNavigatingReload,
} from '@generaltranslation/react-core/internal/experimental';
import { BrowserGTProvider } from '../provider/BrowserGTProvider';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';
import { initializeGTSRAClient } from '../setup/initializeGTSRA';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const BASE_CONFIG: {
  defaultLocale: string;
  locales: string[];
  experimental?: { splitting: 'locale-twins' };
} = { defaultLocale: 'en', locales: ['en', 'fr'] };
const TWINS_CONFIG = {
  ...BASE_CONFIG,
  experimental: { splitting: 'locale-twins' as const },
};

/** A locale twin page: its chunks registered their twins (English here). */
function loadTwinPage() {
  GtInternalRegisterLocaleTwin(
    JSON.stringify({ l: 'en', e: { '0123456789abcdef': 'Hello' } })
  );
}

/** jsdom's `location.reload` cannot be spied on, so swap `window` for the call. */
function stubDocumentReload() {
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  return reload;
}

function switchLocaleInSPA(
  config: typeof BASE_CONFIG,
  softReload: (state: { locale: string }) => void
) {
  initializeI18nConfig(config, 'SPA');
  initializeLocaleTwins(config);
  const store = createOrUpdateBrowserConditionStore({
    locale: 'en',
    _reload: softReload,
  });
  const documentReload = stubDocumentReload();
  store.setLocale('fr');
  return documentReload;
}

async function switchLocaleWithProvider(
  config: typeof BASE_CONFIG,
  softReload: (state: { locale: string }) => void
) {
  initializeGTSRAClient(config);
  let setLocale!: (locale: string) => void;
  function Child() {
    setLocale = useSetLocale();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <BrowserGTProvider
        locale='en'
        translations={{}}
        dictionaries={{}}
        _reload={softReload}
      >
        <Child />
      </BrowserGTProvider>
    );
  });
  const documentReload = stubDocumentReload();
  setLocale('fr');
  vi.unstubAllGlobals();
  await act(async () => root.unmount());
  return documentReload;
}

/**
 * Resets GT state except react-core's context singleton, which the separately
 * bundled `/components` and `/hooks` entries must keep sharing.
 */
function resetGTState() {
  const bag = (globalThis as TestGlobal).__generaltranslation as
    | Record<string, unknown>
    | undefined;
  if (!bag) return;
  for (const key of ['i18n', 'localeTwins']) Reflect.deleteProperty(bag, key);
}

describe('locale switching with locale twins', () => {
  beforeEach(() => {
    resetGTState();
    (globalThis as TestGlobal).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetGTState();
  });

  describe('SPA (condition store)', () => {
    it('follows a soft _reload with a document reload', () => {
      const softReload = vi.fn();
      loadTwinPage();

      const documentReload = switchLocaleInSPA(TWINS_CONFIG, softReload);

      expect(softReload).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'fr' })
      );
      expect(documentReload).toHaveBeenCalledTimes(1);
    });

    it('follows a soft _reload with a document reload before the first twin registers', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const softReload = vi.fn();
      // An entry that only lazy-imports its pages: its GT modules register
      // without a placeholder
      GtInternalRegisterLocaleTwin();

      const documentReload = switchLocaleInSPA(TWINS_CONFIG, softReload);

      expect(softReload).toHaveBeenCalledTimes(1);
      expect(documentReload).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    });

    it('keeps a navigating _reload as the only reload', () => {
      const navigate = markNavigatingReload(vi.fn());
      loadTwinPage();

      const documentReload = switchLocaleInSPA(TWINS_CONFIG, navigate);

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(documentReload).not.toHaveBeenCalled();
    });

    it('lets a soft _reload replace the document reload without twins', () => {
      const softReload = vi.fn();

      const documentReload = switchLocaleInSPA(BASE_CONFIG, softReload);

      expect(softReload).toHaveBeenCalledTimes(1);
      expect(documentReload).not.toHaveBeenCalled();
    });
  });

  describe('server-rendered apps (GTProvider)', () => {
    it('follows a soft _reload with a document reload', async () => {
      const softReload = vi.fn();
      loadTwinPage();

      const documentReload = await switchLocaleWithProvider(
        TWINS_CONFIG,
        softReload
      );

      expect(softReload).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'fr' })
      );
      expect(documentReload).toHaveBeenCalledTimes(1);
    });

    it('lets a soft _reload replace the document reload without twins', async () => {
      const softReload = vi.fn();

      const documentReload = await switchLocaleWithProvider(
        BASE_CONFIG,
        softReload
      );

      expect(softReload).toHaveBeenCalledTimes(1);
      expect(documentReload).not.toHaveBeenCalled();
    });
  });
});
