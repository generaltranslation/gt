import { useCallback } from 'react';
import { decodeOptions } from 'gt-i18n';
import { useGT } from './useGT';
import type { GTTranslationOptions, MFunctionType } from 'gt-i18n/types';
import {
  extractVariables,
  isEncodedTranslationOptions,
} from 'gt-i18n/internal';
import { Message } from './external-store/useTrackedTranslationResolver';

// ===== Hook ===== //

export function useMessages(_messages?: Message[]): MFunctionType {
  const gt = useGT(_messages);

  return useCallback(
    <T extends string | null | undefined>(
      encodedMsg: T,
      options: GTTranslationOptions = {}
    ): T extends string ? string : T => {
      if (encodedMsg == null) {
        return encodedMsg as T extends string ? string : T;
      }

      const decodedOptions = decodeOptions(encodedMsg) ?? {};
      if (isEncodedTranslationOptions(decodedOptions)) {
        // Variables given here fill in those msg() did not have:
        // m(msg('Welcome, {user}!'), { user }) with a compiler-injected $_hash
        return gt(decodedOptions.$_source, {
          ...extractVariables(options),
          ...decodedOptions,
        }) as T extends string ? string : T;
      }

      return gt(encodedMsg, options) as T extends string ? string : T;
    },
    [gt]
  );
}
