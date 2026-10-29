import { getContext, setContext } from 'svelte';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { getI18nCache, getI18nConfig } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { resolveLocale } from './config';
import { hasCachedTranslations, rememberAddedTranslations } from './hydration';

const GT_CONTEXT = Symbol.for('gt-svelte.context');

/**
 * Reactive locale state for one `<GTProvider>` subtree. The translation
 * cache itself is shared, so `revision` lets readers re-run after the cache
 * receives translations asynchronously.
 */
export class GTState {
  locale = $state('');
  revision = $state(0);
  readonly #readonly: boolean;
  /** Counts locale changes, so a slow load cannot override a later one. */
  #request = 0;

  constructor(locale: string, readonly = false) {
    this.locale = locale;
    this.#readonly = readonly;
  }

  /** Marks cached translations as changed so lookups run again. */
  invalidate(): void {
    this.revision += 1;
  }

  /**
   * Loads the new locale's translations before switching, so the current
   * render stays on screen until the next one is ready. When locale changes
   * overlap, the most recent one wins, even if it finishes loading first.
   */
  async setLocale(locale: string): Promise<void> {
    if (this.#readonly) {
      throw new Error(
        createDiagnosticMessage({
          source: 'gt-svelte',
          severity: 'Error',
          whatHappened: 'Cannot change the locale outside <GTProvider>',
          fix: 'Wrap your app in <GTProvider>',
        })
      );
    }
    const resolvedLocale = resolveLocale(locale);
    const request = ++this.#request;
    await getI18nCache().loadTranslations(resolvedLocale);
    if (request === this.#request) this.showLocale(resolvedLocale);
  }

  /**
   * Switches to a locale whose translations are already in the cache, and
   * cancels any pending `setLocale()`.
   */
  showLocale(locale: string): void {
    this.#request += 1;
    this.locale = locale;
    this.invalidate();
  }

  /**
   * Adds preloaded translations to the shared cache. Translations it already
   * holds, such as `loadTranslations()` results rendered on the server, are
   * skipped: copying a large catalog on every request is slow.
   */
  hydrate(locale: string, translations: Record<string, Translation>): void {
    if (hasCachedTranslations(locale, translations)) return;
    // Snapshot in case the translations are reactive state: the cache
    // clones them, and proxies cannot be cloned.
    getI18nCache().updateTranslations({
      [locale]: $state.snapshot(translations) as Record<string, Translation>,
    });
    rememberAddedTranslations(locale, translations);
  }
}

export function setGTState(state: GTState): void {
  setContext(GT_CONTEXT, state);
}

/**
 * Returns the nearest `<GTProvider>` state. Without a provider, content
 * renders in the default locale.
 */
export function getGTState(): GTState {
  const state = getContext<GTState | undefined>(GT_CONTEXT);
  return state ?? new GTState(getI18nConfig().getDefaultLocale(), true);
}
