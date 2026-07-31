import { readonly, type DeepReadonly, type Ref } from 'vue';
import { useGTState } from '../runtime/state';

/**
 * Returns a readonly ref for the active locale.
 *
 * Components, computed values, and render effects that read this ref update
 * after {@link useSetLocale} finishes switching locales. Vue templates unwrap
 * the ref automatically.
 *
 * @returns A readonly reactive locale ref.
 */
export function useLocale(): DeepReadonly<Ref<string>> {
  return readonly(useGTState().locale);
}

/**
 * Returns the active plugin's asynchronous locale setter.
 *
 * The setter loads and caches a missing catalog before updating the reactive
 * locale. It rejects when the configured loader rejects, and only the latest
 * overlapping request is applied.
 *
 * @returns An async function that switches to the requested locale.
 */
export function useSetLocale(): (locale: string) => Promise<void> {
  return useGTState().setLocale;
}
