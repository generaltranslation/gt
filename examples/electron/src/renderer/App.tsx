import { useSyncExternalStore } from 'react';
import {
  GTProvider,
  T,
  getLocaleProperties,
  useGT,
  useLocale,
  useLocales,
} from 'gt-react';

export function App() {
  // The main process owns the locale. Given it as a prop, GTProvider loads that
  // locale's translations and changes locale in place, without a reload.
  const locale = useSyncExternalStore(window.gt.subscribe, window.gt.getLocale);
  return (
    <GTProvider locale={locale}>
      <Page />
    </GTProvider>
  );
}

function Page() {
  const t = useGT();
  const locale = useLocale();
  const locales = useLocales();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <T>
        <h1>Hello from the renderer</h1>
        <p>
          Choose a language here or in the application menu. The page and the
          menu change together.
        </p>
      </T>
      <p>
        <label>
          {t`Language`}{' '}
          <select
            value={locale}
            onChange={(event) => void window.gt.setLocale(event.target.value)}
          >
            {locales.map((option) => (
              <option key={option} value={option}>
                {getLocaleProperties(option).nativeName}
              </option>
            ))}
          </select>
        </label>
      </p>
    </main>
  );
}
