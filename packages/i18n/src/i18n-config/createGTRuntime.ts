import { GTRuntime } from 'generaltranslation/runtime';
import type { I18nConfig } from './I18nConfig';
import { getI18nConfig } from './singleton-operations';

/**
 * Create a GTRuntime (the runtime translation API client) bound to the
 * resolved target locale. Kept outside I18nConfig so only code that actually
 * translates at runtime pulls the API client into a bundle; formatting and
 * locale helpers use I18nConfig's LocaleConfig methods instead.
 */
export function createGTRuntime(
  locale?: string,
  config: I18nConfig = getI18nConfig()
): GTRuntime {
  return new GTRuntime(config.getGTRuntimeParams(locale));
}
