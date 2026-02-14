import { getLocale } from './getLocale';
import type { Translations } from 'gt-react/internal';
import { isSSREnabled } from '../provider/utils/isSSREnabled';
import { getI18nManager } from 'gt-i18n/internal';

/**
 * Put this in the root loader to pass translations to the provider
 */
export async function getTranslations(): Promise<Translations | undefined> {
  const locale = isSSREnabled() ? getLocale() : undefined;
  if (!locale) return undefined;
  const i18nManager = getI18nManager();
  // TODO: improve types by TranslationManager overrides
  // need to cast b/c gt-i18n assumes string only translation
  return (await i18nManager.getTranslation(locale)) as Translations;
}
