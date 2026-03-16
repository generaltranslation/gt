import { BROWSER_ENVIRONMENT_ERROR } from './errors-dir/constants';
import { enforceBrowser } from './i18n-context/utils/enforceBrowser';
enforceBrowser(BROWSER_ENVIRONMENT_ERROR);

export * from './i18n-context/setup/index';
export * from './i18n-context/functions/locale-operations';
export { t } from './i18n-context/functions/translation/t';
