import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';

export function useI18nStore(): I18nStore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}
