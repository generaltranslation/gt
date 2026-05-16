import type { JsxChildren } from '@generaltranslation/format/types';
import { TranslatedChildren } from './types';

export type TranslateIcuCallback = (params: {
  source: string;
  targetLocale: string;
  metadata: { hash: string; context?: string; maxChars?: number } & Record<
    string,
    unknown
  >;
}) => Promise<TranslatedChildren>;

export type TranslateI18nextCallback = TranslateIcuCallback;

export type TranslateChildrenCallback = (params: {
  source: JsxChildren | undefined;
  targetLocale: string;
  metadata: { hash: string; context?: string; maxChars?: number } & Record<
    string,
    unknown
  >;
}) => Promise<TranslatedChildren>;
