export const PACKAGE_NAME = 'gt-react';

// ---- Errors ---- //

export const BROWSER_ENVIRONMENT_ERROR = `${PACKAGE_NAME}/browser Error: The ${PACKAGE_NAME}/browser module requires a browser environment`;
export const GENERIC_BROWSER_ENVIRONMENT_ERROR = `${PACKAGE_NAME} Error: You are trying to import a browser-only module into a non-browser environment.`;
export const BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR = `${PACKAGE_NAME} Error: BrowserI18nManager not initialized. Invoke initializeGT() to initialize.`;

// ---- Warnings ---- //

export const createInvalidLocaleWarning = (locale: string) =>
  `${PACKAGE_NAME} Warning: "${locale}" is not a valid locale.`;

export const createTranslationFailedDueToBrowserEnvironmentWarning = (
  message: string | TemplateStringsArray | undefined
) =>
  `${PACKAGE_NAME} Warning: Translation failed for t("${typeof message === 'string' ? message : '`' + message?.join('${}') + '`'}") because it was used outside of a browser environment. Falling back to original message.`;

export const createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning = ({
  customLocale,
  defaultLocale,
}: {
  customLocale: string;
  defaultLocale: string;
}) =>
  `${PACKAGE_NAME} Warning: Custom getLocale() function returned an unsupported locale: "${customLocale}". Falling back to default locale: "${defaultLocale}".`;
