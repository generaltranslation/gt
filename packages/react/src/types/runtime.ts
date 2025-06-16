import { JsxChildren } from 'generaltranslation/types';
import {
  TranslationSuccess,
  TranslationLoading,
  TranslationError,
} from './types';

export type TranslateIcuCallback = (params: {
  source: string;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;

export type TranslateI18nextCallback = TranslateIcuCallback;

export type TranslateChildrenCallback = (params: {
  source: JsxChildren | undefined;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;
