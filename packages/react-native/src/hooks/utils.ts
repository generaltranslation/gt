import { getVersionId } from '@generaltranslation/react-core/pure';
import {
  useLocale,
  useLocaleDirection as useCoreLocaleDirection,
} from '@generaltranslation/react-core/hooks';

export function useLocaleDirection(locale?: string): 'ltr' | 'rtl' {
  const currentLocale = useLocale();
  return useCoreLocaleDirection(locale ?? currentLocale);
}

export function useVersionId(): string | undefined {
  return getVersionId();
}
