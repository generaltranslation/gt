import { defaultRuntimeApiUrl } from 'generaltranslation/internal';

/**
 * Runtime API translation type
 * - GT: use the default runtime API URL {@link defaultRuntimeApiUrl}
 * - CUSTOM: use a custom runtime API URL
 * - DISABLED: no runtime API translation
 */
export enum TranslationApiType {
  GT = 'gt',
  CUSTOM = 'custom',
  DISABLED = 'disabled',
}

/**
 * Based on the configurtion return the runtime translation type
 * @param params - The parameters to validate
 * @returns The runtime translation type
 */
export function getTranslationApiType(params: {
  runtimeUrl?: string | null;
}): TranslationApiType {
  if (
    params.runtimeUrl === undefined ||
    params.runtimeUrl === defaultRuntimeApiUrl
  ) {
    return TranslationApiType.GT;
  } else if (params.runtimeUrl) {
    return TranslationApiType.CUSTOM;
  } else {
    return TranslationApiType.DISABLED;
  }
}
