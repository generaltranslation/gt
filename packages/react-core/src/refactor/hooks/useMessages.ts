import { useCallback } from 'react';
import { decodeOptions } from 'gt-i18n';
import { useGT } from './useGT';
import type { _Messages } from '../../types-dir/types';
import type { InlineResolveOptions, MFunctionType } from 'gt-i18n/types';
import { isEncodedTranslationOptions } from 'gt-i18n/internal';

// ===== Hook ===== //

export function useMessages(_messages?: _Messages): MFunctionType {
  const gt = useGT(_messages);

  return useCallback(
    <T extends string | null | undefined>(
      encodedMsg: T,
      options: InlineResolveOptions = {}
    ): T extends string ? string : T => {
      if (encodedMsg == null) {
        return encodedMsg as T extends string ? string : T;
      }

      const decodedOptions = decodeOptions(encodedMsg) ?? {};
      if (isEncodedTranslationOptions(decodedOptions)) {
        return gt(decodedOptions.$_source, decodedOptions) as T extends string
          ? string
          : T;
      }

      return gt(encodedMsg, options) as T extends string ? string : T;
    },
    [gt]
  );
}
