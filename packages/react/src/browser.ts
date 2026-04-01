import { BROWSER_ENVIRONMENT_ERROR } from './shared/messages';
import { enforceBrowser } from './i18n-context/utils/enforceBrowser';
enforceBrowser(BROWSER_ENVIRONMENT_ERROR);

// ----- Exports ----- //

export * from './i18n-context/setup/index';
export * from './i18n-context/functions/locale-operations';
export * from './i18n-context/functions/versionId';
export * from './i18n-context/functions/variables';
export * from './i18n-context/functions/translation';
export { LocaleSelector } from './i18n-context/ui/LocaleSelector';
