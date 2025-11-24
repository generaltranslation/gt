import { BaseTranslationOptions } from '../types';
/**
 * Given an object of options, returns an object with no gt-related options
 *
 * TODO: next major version, this should extract any sugar syntax options
 * TODO: next major version, options should be Record<string, string>
 */
export function extractVariables<T extends BaseTranslationOptions>(
  options: T
): BaseTranslationOptions {
  return Object.fromEntries(
    Object.entries(options).filter(
      ([key]) =>
        key !== '$id' &&
        key !== '$context' &&
        key !== '$hash' && // this is already being done in @gt/react-core
        key !== '$_hash' &&
        key !== '$_source'
    )
  );
}
