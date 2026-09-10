import { AsyncLocalStorage } from 'node:async_hooks';
import { resolveLocaleOrDefault } from './localeValidation';

type GlobalWithNextRequestState = {
  __generaltranslation?: {
    next?: {
      registeredLocale?: AsyncLocalStorage<string>;
    };
  };
};

const globalObject = globalThis as GlobalWithNextRequestState;
globalObject.__generaltranslation ??= {};
globalObject.__generaltranslation.next ??= {};
const registeredLocaleStore =
  (globalObject.__generaltranslation.next.registeredLocale ??=
    new AsyncLocalStorage());

/**
 * Set the locale for the current request context.
 * Use this in Route Handlers and OG image handlers where next/root-params is unavailable.
 * Must be called at the top of the request handler before any other gt-next functions.
 *
 * @param locale - A locale candidate to use for this request.
 */
export function registerLocale(locale: string): void {
  registeredLocaleStore.enterWith(resolveLocaleOrDefault(locale));
}

/** @internal */
export function getRegisteredLocale(): string | undefined {
  return registeredLocaleStore.getStore();
}
