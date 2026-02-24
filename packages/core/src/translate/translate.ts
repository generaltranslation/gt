import {
  TranslationRequestConfig,
  TranslationError,
  TranslationResult,
} from '../types';
import { Content } from '../types-dir/jsx/content';
import { EntryMetadata, SharedMetadata } from '../types-dir/api/entry';
import _translateMany from './translateMany';

/**
 * @internal
 *
 * Translates a single entry in a single API request.
 *
 * @param source - The source content to translate.
 * @param targetLocale - The target locale to translate to.
 * @param metadata - The metadata for the translation.
 * @param config - The configuration for the translation.
 * @returns The result of the translation.
 */
export default async function _translate(
  source: Content,
  globalMetadata: {
    targetLocale: string;
    sourceLocale: string;
    timeout?: number;
  } & SharedMetadata,
  metadata: EntryMetadata = {},
  config: TranslationRequestConfig
): Promise<TranslationResult | TranslationError> {
  const requests = [{ source, metadata }];
  const results = await _translateMany(requests, globalMetadata, config);
  return results[0] as TranslationResult | TranslationError;
}
