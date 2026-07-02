import { decodeOptions } from '../translation-functions/msg/decodeOptions';
import { isEncodedTranslationOptions } from '../translation-functions/utils/isEncodedTranslationOptions';
import type {
  GTFunctionType,
  MFunctionType,
} from '../translation-functions/types/functions';
import type { GTTranslationOptions } from '../translation-functions/types/options';

/**
 * Builds an `m()` function that resolves `msg()`-encoded strings through the
 * given `gt()` function.
 *
 * Shared by the framework bindings (gt-react via react-core, gt-vue).
 */
export function createMFunction(gt: GTFunctionType): MFunctionType {
  return (<T extends string | null | undefined>(
    encodedMsg: T,
    options: GTTranslationOptions = {}
  ): T extends string ? string : T => {
    type Result = T extends string ? string : T;
    if (encodedMsg == null) return encodedMsg as Result;

    const decodedOptions = decodeOptions(encodedMsg) ?? {};
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions) as Result;
    }
    return gt(encodedMsg, options) as Result;
  }) as MFunctionType;
}
