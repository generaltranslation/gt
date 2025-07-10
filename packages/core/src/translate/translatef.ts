import {
  _formatI18next,
  _formatJsx,
  _formatMessage,
} from '../formatting/format';
import {
  TranslationMetadata,
  TranslationConfig,
  FormatVariables,
  TranslationContent,
  JsxChildren,
  IcuMessage,
  I18nextMessage,
} from '../types';
import _translate from './translate';

/**
 * @internal
 *
 * This function is used to translate a string and format it according to the
 * metadata. It is used to translate strings that are not JSX or ICU messages.
 *
 * @param source - The source string to translate.
 * @param targetLocale - The target locale to translate to.
 * @param metadata - The metadata for the translation.
 * @param variables - The variables to use for formatting.
 * @param config - The configuration for the translation.
 * @returns The formatted translation.
 */
export default async function translatef(
  source: TranslationContent,
  targetLocale: string,
  metadata: TranslationMetadata,
  variables?: FormatVariables,
  config?: TranslationConfig
) {
  // Get translation
  const result = await _translate(source, targetLocale, metadata, config);
  if ('error' in result) {
    return result;
  }

  // Format translation
  if (metadata.dataFormat === 'ICU') {
    const locales = [
      targetLocale,
      ...(metadata.sourceLocale ? [metadata.sourceLocale] : []),
    ];
    return _formatMessage(result.translation as IcuMessage, locales, variables);
  }

  if (metadata.dataFormat === 'I18NEXT') {
    return _formatI18next(result.translation as I18nextMessage, variables);
  }

  // Jsx
  return _formatJsx(result.translation as JsxChildren, variables);
}
