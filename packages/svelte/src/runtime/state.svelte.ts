import { getContext, setContext } from 'svelte';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getI18nCache, getI18nConfig, hashContent } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
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
  /**
   * The translations given to or loaded by this provider, by locale, which
   * outlive their shared cache entries' expiry.
   */
  readonly #translations = new Map<string, Record<string, Content>>();
  /** The provider above this one, whose translations lookups fall back to. */
  readonly #parent: GTState | undefined;

  constructor(locale: string, readonly = false, parent?: GTState) {
    this.locale = locale;
    this.#readonly = readonly;
    this.#parent = parent;
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
    const translations = await getI18nCache().loadTranslations(resolvedLocale);
    if (request !== this.#request) return;
    this.#translations.set(resolvedLocale, translations);
    this.showLocale(resolvedLocale);
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
   * Keeps preloaded translations for this provider's lookups and adds them to
   * the shared cache. Translations the cache already holds, such as
   * `loadTranslations()` results rendered on the server, are not added again:
   * copying a large catalog on every request is slow.
   */
  hydrate(locale: string, translations: Record<string, Content>): void {
    this.#translations.set(locale, translations);
    if (hasCachedTranslations(locale, translations)) return;
    // Snapshot in case the translations are reactive state: the cache
    // clones them, and proxies cannot be cloned. Svelte's Snapshot type cannot
    // expand recursive message trees, so it snapshots plain records.
    getI18nCache().updateTranslations({
      [locale]: $state.snapshot<Record<string, unknown>>(
        translations
      ) as Record<string, Content>,
    });
    rememberAddedTranslations(locale, translations);
  }

  /**
   * Looks up a translation in this provider's translations, then in the
   * cache. A server render reads only the `<GTProvider>` translations, which
   * the browser also receives, so runtime translations the shared cache got
   * since cannot make the two differ.
   */
  lookupTranslation(
    locale: string,
    content: Content,
    options: LookupOptions
  ): Content | undefined {
    if (this.#hasTranslations()) {
      const translation = this.#lookupGiven(
        locale,
        hashContent(content, options)
      );
      if (translation !== undefined || typeof window === 'undefined') {
        return translation;
      }
    }
    return getI18nCache().lookupTranslation(locale, content, options);
  }

  #hasTranslations(): boolean {
    return (
      this.#translations.size > 0 ||
      (this.#parent ? this.#parent.#hasTranslations() : false)
    );
  }

  /** Reads this provider's translations, then those of the providers above it. */
  #lookupGiven(locale: string, hash: string): Content | undefined {
    return (
      this.#translations.get(locale)?.[hash] ??
      (this.#parent ? this.#parent.#lookupGiven(locale, hash) : undefined)
    );
  }
}

export function setGTState(state: GTState): void {
  setContext(GT_CONTEXT, state);
}

/** Returns the state of the `<GTProvider>` above the current component, if any. */
export function getParentGTState(): GTState | undefined {
  return getContext<GTState | undefined>(GT_CONTEXT);
}

/**
 * Returns the nearest `<GTProvider>` state. Without a provider, content
 * renders in the default locale.
 */
export function getGTState(): GTState {
  return (
    getParentGTState() ?? new GTState(getI18nConfig().getDefaultLocale(), true)
  );
}
