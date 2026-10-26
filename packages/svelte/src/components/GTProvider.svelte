<!--
  @component
  Provides the active locale to `<T>`, `useGT()`, and the variable
  components below it. Pass the result of `loadTranslations()` so the first
  render, on the server and in the browser, is already translated.

  ```svelte
  <GTProvider locale={data.gt.locale} translations={data.gt.translations}>
    {@render children()}
  </GTProvider>
  ```
-->
<script lang="ts">
  import type { Translation } from 'gt-i18n/types';
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { resolveLocale } from '../runtime/config';
  import { GTState, setGTState } from '../runtime/state.svelte';

  let {
    locale,
    translations,
    children,
  }: {
    /** The locale to render. Defaults to the configured default locale. */
    locale?: string;
    /** Preloaded translations for `locale`, from `loadTranslations()`. */
    translations?: Record<string, Translation>;
    children?: Snippet;
  } = $props();

  // Initialize synchronously so server rendering and hydration see the
  // translations on the first render.
  const state = untrack(() => {
    const initialLocale = resolveLocale(locale);
    const initialState = new GTState(initialLocale);
    if (translations) initialState.hydrate(initialLocale, translations);
    return initialState;
  });
  setGTState(state);

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
      if (translations) {
        state.locale = nextLocale;
        state.invalidate();
      } else {
        void state.setLocale(nextLocale);
      }
    });
  });
</script>

{@render children?.()}
