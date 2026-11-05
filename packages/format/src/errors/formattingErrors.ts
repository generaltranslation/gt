export const createInvalidCutoffStyleError = (style: string) =>
  `generaltranslation Formatting Error: Invalid cutoff style: ${style}.`;
export const createMissingMessageFormatterError = () =>
  'generaltranslation Formatting Error: ICU message formatting needs the LocaleConfig exported from @generaltranslation/format, or a messageFormatter passed to LocaleConfigBase.';
