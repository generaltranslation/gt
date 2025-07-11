const GT_ERROR_PREFIX = 'GT error:';

export const translationTimeoutError = (timeout: number) =>
  `${GT_ERROR_PREFIX} Translation request timed out after ${timeout}ms. This has either occured due to the translation of an unusually large request or a translation failure in the API.`;

export const translationRequestFailedError = (error: string) =>
  `${GT_ERROR_PREFIX} Translation request failed. Error: ${error}`;

export const translationApiError = (
  status: number,
  statusText: string,
  error: string
) =>
  `${GT_ERROR_PREFIX} Translation API returned error status. Status: ${status}, Status Text: ${statusText}, Error: ${error}`;

export const noTargetLocaleProvidedError = (functionName: string) =>
  `${GT_ERROR_PREFIX} Cannot call \`${functionName}\` without a specified locale. Either pass a locale to the \`${functionName}\` function or specify a targetLocale in the GT constructor.`;

export const noSourceLocaleProvidedError = (functionName: string) =>
  `${GT_ERROR_PREFIX} Cannot call \`${functionName}\` without a specified locale. Either pass a locale to the \`${functionName}\` function or specify a sourceLocale in the GT constructor.`;

export const noProjectIdProvidedError = (functionName: string) =>
  `${GT_ERROR_PREFIX} Cannot call \`${functionName}\` without a specified project ID. Either pass a project ID to the \`${functionName}\` function or specify a projectId in the GT constructor.`;

export const invalidLocaleError = (locale: string) =>
  `${GT_ERROR_PREFIX} Invalid locale: ${locale}.`;

export const invalidLocalesError = (locales: string[]) =>
  `${GT_ERROR_PREFIX} Invalid locales: ${locales.join(', ')}.`;
