import { EncodedTranslationOptions } from '../../types';

/**
 * Given a decoded options object, validate that includes required decoded options
 * These required options are added by msg() during the encoding process.
 */
export function isEncodedTranslationOptions(
  decodedOptions: Record<string, any> // TODO: next major version, this should be Record<string, string>
): decodedOptions is EncodedTranslationOptions {
  return !!(decodedOptions.$_hash && decodedOptions.$_source);
}
