import {
  TranslationsObject,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
} from './types';
import { TranslateContentCallback, TranslateChildrenCallback } from './runtime';
import GT from 'generaltranslation';

export type GTContextType = {
  gt: GT;
  registerContentForTranslation: TranslateContentCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  _internalUseGTFunction: (
    string: string,
    options?: InlineTranslationOptions
  ) => string;
  _internalUseTranslationsFunction: (
    id: string,
    options?: DictionaryTranslationOptions
  ) => string;
  runtimeTranslationEnabled: boolean;
  locale: string;
  locales: string[];
  setLocale: (locale: string) => void;
  defaultLocale: string;
  translations: TranslationsObject | null;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  renderSettings: { method: RenderMethod; timeout?: number };
  projectId?: string;
};
