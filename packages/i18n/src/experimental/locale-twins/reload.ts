import { isLocaleTwinsClient } from './runtime';

/** @internal `Symbol.for()` key of the navigating-reload brand. */
export const NAVIGATING_RELOAD_KEY =
  'generaltranslation.locale-twins.navigating-reload';

type Reload<State> = (state: State) => void;

/**
 * Marks a custom `_reload` as one that navigates the document (for example
 * `location.assign()` to a locale-prefixed path). Locale twin clients keep
 * such a reload; any other custom reload is followed by a document reload.
 */
export function markNavigatingReload<T extends Reload<never>>(reload: T): T {
  Object.defineProperty(reload, Symbol.for(NAVIGATING_RELOAD_KEY), {
    value: true,
  });
  return reload;
}

function isNavigatingReload(reload: Reload<never>): boolean {
  return (
    (reload as unknown as Record<symbol, unknown>)[
      Symbol.for(NAVIGATING_RELOAD_KEY)
    ] === true
  );
}

type BrowserGlobals = { window?: { location: { reload(): void } } };

/**
 * The `_reload` for a locale (or region / enableI18n) switch with locale
 * twins. A locale twin client must load a new document so that only the new
 * locale's twins load: a custom reload that does not navigate (a soft
 * re-render) runs first and is then followed by a document reload. Without a
 * custom reload the runtime already reloads the document.
 */
export function withLocaleTwinReload<State>(
  reload: Reload<State> | undefined
): Reload<State> | undefined {
  if (!reload || isNavigatingReload(reload as Reload<never>)) return reload;
  return (state) => {
    reload(state);
    if (isLocaleTwinsClient()) {
      (globalThis as BrowserGlobals).window?.location.reload();
    }
  };
}
