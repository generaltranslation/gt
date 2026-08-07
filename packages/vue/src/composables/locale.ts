import { toRef, type Ref } from 'vue';
import { useGTState } from '../runtime/state';

/**
 * Returns a readonly ref for the active locale.
 *
 * With a {@link createGT} plugin, components, computed values, and render
 * effects that read this ref update after {@link useSetLocale} finishes
 * switching locales. An `initializeGTSPA()` plugin reloads the page instead so
 * module-level translations are evaluated again. Vue templates unwrap the ref
 * automatically.
 *
 * @returns A readonly reactive locale ref.
 */
export function useLocale(): Readonly<Ref<string>> {
  const state = useGTState();
  return toRef(state.getLocale);
}

/**
 * Returns the active plugin's asynchronous locale setter.
 *
 * A {@link createGT} plugin loads and caches a missing catalog before updating
 * reactive consumers. An `initializeGTSPA()` plugin writes the locale cookie
 * and reloads the page without loading the target catalog on the current page.
 *
 * @returns An async function that switches to the requested locale.
 */
export function useSetLocale(): (locale: string) => Promise<void> {
  return useGTState().setLocale;
}
