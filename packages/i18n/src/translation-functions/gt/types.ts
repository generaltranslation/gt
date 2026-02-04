import { InlineTranslationOptions } from '../../types';

// TODO: next major version, this should be <T extends string | null | undefined>(message: T, options?: InlineTranslationOptions) => T extends string ? string : T;
export type GTFunctionType = (
  message: string,
  options?: InlineTranslationOptions
) => string;
