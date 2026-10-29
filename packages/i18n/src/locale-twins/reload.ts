import { isLocaleTwinsClient } from './runtime';

const NAVIGATING_RELOAD = Symbol.for(
  'generaltranslation.locale-twins.navigating-reload'
);

type Reload<State> = (state: State) => void;

/**
 * Marks a custom `_reload` as one that navigates the document (for example
 * `location.assign()` to a locale-prefixed path). Locale twin clients keep
 * such a reload; any other custom reload is followed by a document reload.
 */
export function markNavigatingReload<T extends Reload<never>>(reload: T): T {
  Object.defineProperty(reload, NAVIGATING_RELOAD, { value: true });
  return reload;
}

function isNavigatingReload(reload: Reload<never>): boolean {
  return (
    (reload as unknown as Record<symbol, unknown>)[NAVIGATING_RELOAD] === true
  );
}

type BrowserGlobals = { window?: { location: { reload(): void } } };

function reloadDocument(): void {
  (globalThis as BrowserGlobals).window?.location.reload();
}

/**
 * Runs the reload after a locale (or region / enableI18n) switch.
 *
 * Without locale twins this is the custom `reload` when given, else a document
 * reload. A locale twin client must load a new document so that only the new
 * locale's twins load, so a custom reload that does not navigate (a soft
 * re-render) runs first and is then followed by a document reload.
 */
export function reloadForLocaleSwitch<State>(
  state: State,
  reload?: Reload<State>
): void {
  if (!reload) return reloadDocument();
  reload(state);
  if (isLocaleTwinsClient() && !isNavigatingReload(reload)) reloadDocument();
}
