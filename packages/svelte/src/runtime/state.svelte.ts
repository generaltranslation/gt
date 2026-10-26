import { getContext, setContext } from 'svelte';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { getI18nCache, getI18nConfig } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { resolveLocale } from './config';

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
   * render stays on screen until the next one is ready.
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
    await getI18nCache().loadTranslations(resolvedLocale);
    this.locale = resolvedLocale;
    this.invalidate();
  }

  /** Adds preloaded translations to the shared cache. */
  hydrate(locale: string, translations: Record<string, Translation>): void {
    // Snapshot in case the translations are reactive state: the cache
    // clones them, and proxies cannot be cloned.
    getI18nCache().updateTranslations({
      [locale]: $state.snapshot(translations) as Record<string, Translation>,
    });
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
