import { useCallback } from 'react';
import { decodeOptions } from 'gt-i18n';
import {
  extractVariables,
  isEncodedTranslationOptions,
} from 'gt-i18n/internal';
import type { GTTranslationOptions, MFunctionType } from 'gt-i18n/types';
import type { Message } from '../../hooks/external-store/useTrackedTranslationResolver';
import { useGT } from './useGT';

/**
 * `useMessages()` with locale twins: resolves through the locale twin
 * `useGT()`. Variables given to `m()` fill in those `msg()` did not have:
 * `m(msg('Welcome, {user}!'), { user })` with the compiler-injected `$_hash`.
 */
export function useMessages(_messages?: Message[]): MFunctionType {
  const gt = useGT(_messages);

  return useCallback(
    <T extends string | null | undefined>(
      encodedMsg: T,
      options: GTTranslationOptions = {}
    ): T extends string ? string : T => {
      type Result = T extends string ? string : T;
      if (encodedMsg == null) return encodedMsg as Result;

      const decodedOptions = decodeOptions(encodedMsg) ?? {};
      if (isEncodedTranslationOptions(decodedOptions)) {
        return gt(decodedOptions.$_source, {
          ...extractVariables(options),
          ...decodedOptions,
        }) as Result;
      }

      return gt(encodedMsg, options) as Result;
    },
    [gt]
  );
}
