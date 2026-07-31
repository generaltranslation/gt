import { readonly, type DeepReadonly, type Ref } from 'vue';
import { useGTState } from './state';

export function useLocale(): DeepReadonly<Ref<string>> {
  return readonly(useGTState().locale);
}

export function useSetLocale(): (locale: string) => Promise<void> {
  return useGTState().setLocale;
}
