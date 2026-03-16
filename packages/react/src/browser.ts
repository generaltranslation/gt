import { BROWSER_ENVIRONMENT_ERROR } from './errors-dir/constants';

if (typeof window === 'undefined') {
  throw new Error(BROWSER_ENVIRONMENT_ERROR);
}

export * from './i18n-context/setup/index';
export * from './i18n-context/translation/t';
export { t } from './i18n-context/translation/t';
