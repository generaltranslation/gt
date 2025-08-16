import {
  Translations,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
  _Messages,
} from './types';
import { TranslateIcuCallback, TranslateChildrenCallback } from './runtime';
import { GT } from 'generaltranslation';

export type GTContextType = {
  gt: GT;
  registerIcuForTranslation: TranslateIcuCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  _tFunction: (
    message: string,
    options?: InlineTranslationOptions,
    preloadedTranslations?: Translations
  ) => string;
  _preloadMessages: (_messages: _Messages) => Promise<Translations>;
  _dictionaryFunction: (
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
