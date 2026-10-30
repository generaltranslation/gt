<!--
  @component
  Provides the active locale to `<T>`, `useGT()`, and the variable
  components below it. Pass the result of `loadTranslations()` so the first
  render, on the server and in the browser, is already translated. Without
  `translations`, the provider renders the default locale until the browser
  has loaded `locale`.

  ```svelte
  <GTProvider locale={data.gt.locale} translations={data.gt.translations}>
    {@render children()}
  </GTProvider>
  ```
-->

<svelte:options preserveWhitespace={false} />

<script lang="ts">
  import type { Content } from '@generaltranslation/format';
  import { getI18nConfig } from 'gt-i18n/internal';
  import type { Snippet } from 'svelte';
  import { onMount, untrack } from 'svelte';
  import { resolveLocale } from '../runtime/config';
  import { requiresTranslation } from '../runtime/lookup';
  import { GTState, setGTState } from '../runtime/state.svelte';
  import {
    warnLocaleLoadFailed,
    warnMissingProviderTranslations,
  } from '../runtime/warnings';

  let {
    locale,
    translations,
    children,
  }: {
    /** The locale to render. Defaults to the configured default locale. */
    locale?: string;
    /** Preloaded translations for `locale`, from `loadTranslations()`. */
    translations?: Record<string, Content>;
    children?: Snippet;
  } = $props();

  // The first render has to match on the server and during hydration, so it
  // only trusts the `translations` prop, which both sides receive. Without
  // it, a locale that needs translating starts in the default locale (not
  // whatever the shared cache holds) and loads after mount in the browser.
  const requestedLocale = untrack(() => resolveLocale(locale));
  const state = untrack(() => {
    if (translations) {
      const initialState = new GTState(requestedLocale);
      initialState.hydrate(requestedLocale, translations);
      return initialState;
    }
    if (!requiresTranslation(requestedLocale)) {
      return new GTState(requestedLocale);
    }
    warnMissingProviderTranslations(requestedLocale);
    return new GTState(getI18nConfig().getDefaultLocale());
  });
  setGTState(state);

  function load(nextLocale: string): void {
    state
      .setLocale(nextLocale)
      .catch((error: unknown) => warnLocaleLoadFailed(nextLocale, error));
  }

  onMount(() => {
    if (state.locale !== requestedLocale) load(requestedLocale);
  });

  // Follow later prop changes, such as a navigation that reran `load`.
  let previous = untrack(() => ({ locale, translations }));
  $effect.pre(() => {
    if (locale === previous.locale && translations === previous.translations) {
      return;
    }
    previous = { locale, translations };
    const nextLocale = resolveLocale(locale);
    if (translations) state.hydrate(nextLocale, translations);
    untrack(() => {
      if (translations) state.showLocale(nextLocale);
      else load(nextLocale);
    });
  });
</script>

{@render children?.()}
