import {
  Translations,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
} from './types';
import { TranslateIcuCallback, TranslateChildrenCallback } from './runtime';
import { GT } from 'generaltranslation';

export type GTContextType = {
  gt: GT;
  registerIcuForTranslation: TranslateIcuCallback;
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
  region: string | undefined;
  setRegion: (region: string | undefined) => void;
  translations: Translations | null;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  renderSettings: { method: RenderMethod; timeout?: number };
  projectId?: string;
};
