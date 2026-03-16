export const PACKAGE_NAME = 'gt-react';
export const BROWSER_ENVIRONMENT_ERROR = `${PACKAGE_NAME}/browser Error: The ${PACKAGE_NAME}/browser module requires a browser environment`;
export const T_MUST_BE_USED_IN_BROWSER_ENVIRONMENT_ERROR = `${PACKAGE_NAME} Error: The t() function must be used in a browser environment`;
export const createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning = ({
  customLocale,
  defaultLocale,
}: {
  customLocale: string;
  defaultLocale: string;
}) =>
  `${PACKAGE_NAME} Warning: Custom getLocale() function returned an unsupported locale: "${customLocale}". Falling back to default locale: "${defaultLocale}".`;
export const BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR = `${PACKAGE_NAME} Error: BrowserI18nManager not initialized. Invoke initializeGT() to initialize.`;
