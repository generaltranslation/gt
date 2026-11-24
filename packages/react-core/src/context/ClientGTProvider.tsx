import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import type { LocaleCandidates } from 'gt-i18n/internal';
import {
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { I18nStore } from '../i18n-store/I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';
import { getGTContext } from './context';
import {
  InternalGTProvider,
  type InternalGTProviderProps,
} from './InternalGTProvider';

type Conditions = Pick<
  InternalGTProviderProps,
  'locale' | 'region' | 'enableI18n'
>;

/**
 * Where a platform keeps what the visitor chose between visits: cookies in a
 * browser, native storage in an app.
 */
export type ConditionStorage = {
  /** `locale` is the saved locale, then the platform's own languages. */
  read(): Omit<Conditions, 'locale'> & { locale: LocaleCandidates };
  save(conditions: Partial<Conditions>): void;
};

export type ClientGTProviderProps = Partial<Omit<Conditions, 'locale'>> & {
  children?: ReactNode;
  /**
   * The locale to render, or locales in order of preference. Without it, the
   * provider follows the locale the visitor last chose, then the platform's
   * languages. With it, the app decides, and nothing is saved.
   */
  locale?: string | readonly string[];
  /**
   * Rendered until the first locale's translations have loaded. It is inside
   * GT, with no translations yet, so `<T>` and the hooks render source text.
   */
  fallback?: ReactNode;
  /**
   * Called with the supported locale that the one given to `useSetLocale()`
   * or `<LocaleSelector>` resolves to. With a `locale` prop, this is how the
   * app learns of the choice.
   */
  onLocaleChange?: (locale: string) => void;
};

type LoadedLocale = Pick<InternalGTProviderProps, 'locale' | 'translations'>;

const subscribeToNothing = () => () => undefined;

/**
 * A provider for an app that renders only on the client. It loads each
 * locale's translations itself and changes locale in place. gt-react and
 * gt-react-native give it their storage.
 */
export function ClientGTProvider({
  storage,
  locale,
  region,
  enableI18n,
  fallback,
  onLocaleChange,
  whenOutermost,
  children,
}: ClientGTProviderProps & {
  storage: ConditionStorage;
  /** Rendered beside the content unless this provider is inside another: what a platform keeps for the whole page. */
  whenOutermost?: ReactNode;
}) {
  const i18nConfig = getI18nConfig();
  const nested = useContext(getGTContext()) !== undefined;
  // False while a server's HTML hydrates. The server rendered without what
  // this browser has saved, so the first render here does too.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  // What the visitor chose, here or on an earlier visit. A prop takes the
  // place of the matching condition, and then its setter changes nothing here.
  const [chosen, setChosen] = useState(() => {
    const saved = storage.read();
    return {
      ...saved,
      locale: i18nConfig.resolveSupportedLocale(saved.locale),
      localeChosenHere: false,
    };
  });
  const visitor = hydrated ? chosen : undefined;
  const targetLocale = i18nConfig.resolveSupportedLocale(
    typeof locale === 'object' ? [...locale] : (locale ?? visitor?.locale)
  );
  const [loaded, setLoaded] = useState<LoadedLocale>();
  // Each choice of a locale loads the target again, which is how a failed load is tried again.
  const [attempt, loadAgain] = useReducer((count: number) => count + 1, 0);
  // Saved once it has loaded, so that storage never names a locale the visitor has not seen.
  const saveLocale = locale === undefined && chosen.localeChosenHere;

  // A setter can be kept from an earlier render, so each reads the props of the latest one. An insertion effect runs before any effect of the components below, which can call a setter.
  const latestProps = useRef({ locale, region, enableI18n, onLocaleChange });
  useInsertionEffect(() => {
    latestProps.current = { locale, region, enableI18n, onLocaleChange };
  });

  useEffect(() => {
    if (!hydrated) return;
    let latest = true;
    const i18nCache = getReactI18nCache();
    i18nCache
      .ensureTranslations(targetLocale)
      .then(() => i18nCache.loadTranslations(targetLocale))
      .then(
        (translations) => {
          if (!latest) return;
          setLoaded({
            locale: targetLocale,
            translations: { [targetLocale]: translations },
          });
          if (saveLocale) storage.save({ locale: targetLocale });
        },
        (error: unknown) => {
          if (!latest) return;
          console.warn(createLoadWarning(targetLocale, error));
          // With nothing loaded yet, render the source. No translations are named for the locale, so the cache keeps none and a later load can fill it.
          setLoaded(
            (previous) => previous ?? { locale: targetLocale, translations: {} }
          );
        }
      );
    return () => {
      latest = false;
    };
  }, [hydrated, storage, targetLocale, saveLocale, attempt]);

  const setLocale = useCallback(
    (nextLocale: string) => {
      const resolvedLocale = i18nConfig.resolveSupportedLocale(nextLocale);
      latestProps.current.onLocaleChange?.(resolvedLocale);
      loadAgain();
      if (latestProps.current.locale !== undefined) return;
      setChosen((previous) => ({
        ...previous,
        locale: resolvedLocale,
        localeChosenHere: true,
      }));
    },
    [i18nConfig]
  );
  const setRegion = useCallback(
    (nextRegion: string | undefined) => {
      if (latestProps.current.region !== undefined) return;
      storage.save({ region: nextRegion });
      setChosen((previous) => ({ ...previous, region: nextRegion }));
    },
    [storage]
  );
  const setEnableI18n = useCallback(
    (nextEnableI18n: boolean) => {
      if (latestProps.current.enableI18n !== undefined) return;
      storage.save({ enableI18n: nextEnableI18n });
      setChosen((previous) => ({ ...previous, enableI18n: nextEnableI18n }));
    },
    [storage]
  );

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  return (
    <InternalGTProvider
      locale={loaded?.locale ?? targetLocale}
      translations={loaded?.translations ?? I18nStore.sourceOnly}
      // An empty region is no region, as it is when read back from storage.
      region={(region ?? visitor?.region) || undefined}
      enableI18n={enableI18n ?? visitor?.enableI18n ?? true}
      setLocale={setLocale}
      setRegion={setRegion}
      setEnableI18n={setEnableI18n}
      i18nStore={i18nStoreRef.current}
    >
      {!nested && whenOutermost}
      {loaded ? children : fallback}
    </InternalGTProvider>
  );
}

function createLoadWarning(locale: string, error: unknown): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Warning',
    whatHappened: `Could not load translations for locale "${locale}"`,
    wayOut:
      'The locale on screen stays as it was. Choosing the locale again loads it again',
    details: formatDiagnosticErrorDetails(error),
  });
}
