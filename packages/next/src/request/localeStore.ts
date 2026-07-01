import { AsyncLocalStorage } from 'node:async_hooks';
import { createGlobalSingleton } from 'gt-i18n/internal';

const localeStoreSingleton = createGlobalSingleton<AsyncLocalStorage<string>>({
  namespace: 'next',
  key: 'localeStore',
  source: 'gt-next',
  notInitialized: () => 'Locale store has not been initialized.',
});

if (!localeStoreSingleton.isInitialized()) {
  localeStoreSingleton.set(new AsyncLocalStorage<string>());
}

export const localeStore = localeStoreSingleton.get();
