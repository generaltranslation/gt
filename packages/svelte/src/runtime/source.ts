import { getContext, setContext } from 'svelte';
import { getI18nConfig } from 'gt-i18n/internal';
import { getGTState } from './state.svelte';

const SOURCE_CONTEXT = Symbol.for('gt-svelte.source');

type SourceContent = { readonly current: boolean };

/** Tells content below a `<T>` whether it renders as source content. */
export function setSourceContent(source: SourceContent): void {
  setContext(SOURCE_CONTEXT, source);
}

/**
 * Returns the locale that content renders in, as a reactive `current`
 * property: the active locale, or the default locale while a `<T>` renders
 * its source content because it has no translation, as in gt-react. Call it
 * during component initialization.
 */
export function useContentLocale(): { readonly current: string } {
  const state = getGTState();
  const source = getContext<SourceContent | undefined>(SOURCE_CONTEXT);
  return {
    get current() {
      return source?.current
        ? getI18nConfig().getDefaultLocale()
        : state.locale;
    },
  };
}
