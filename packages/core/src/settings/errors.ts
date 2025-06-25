export const noTargetLocaleProvidedError = (functionName: string) =>
  `GT error: Cannot call \`${functionName}\` without a specified locale. Either pass a locale to the \`${functionName}\` function or specify a targetLocale in the GT constructor.`;

export const noSourceLocaleProvidedError = (functionName: string) =>
  `GT error: Cannot call \`${functionName}\` without a specified locale. Either pass a locale to the \`${functionName}\` function or specify a sourceLocale in the GT constructor.`;

export const invalidLocaleError = (locale: string) =>
  `GT error: Invalid locale: ${locale}.`;

export const invalidLocalesError = (locales: string[]) =>
  `GT error: Invalid locales: ${locales.join(', ')}.`;

export const missingsArgumentError = (functionName: string, argName: string) =>
  `GT error: Cannot call \`${functionName}\` without the following argument: ${argName}. You can pass this argument to the \`${functionName}\` function or specify it in the GT constructor.`;
