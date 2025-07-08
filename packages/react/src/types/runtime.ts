import { JsxChildren } from 'generaltranslation/types';
import { TranslatedChildren } from './types';

export type TranslateIcuCallback = (params: {
  source: string;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslatedChildren>;

export type TranslateI18nextCallback = TranslateIcuCallback;

export type TranslateChildrenCallback = (params: {
  source: JsxChildren | undefined;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslatedChildren>;
