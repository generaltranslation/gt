import { BROWSER_ENVIRONMENT_ERROR } from './deprecated/shared/messages';
import { enforceBrowser } from './deprecated/i18n-context/utils/enforceBrowser';
enforceBrowser(BROWSER_ENVIRONMENT_ERROR);

// ----- Exports ----- //

export * from './deprecated/i18n-context/setup/index';
export * from './deprecated/i18n-context/functions/index';
export { LocaleSelector } from './deprecated/i18n-context/ui/LocaleSelector';
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from 'gt-i18n/types';
