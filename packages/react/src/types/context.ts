import {
  Translations,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
  _Messages,
  _Message,
} from './types';
import { TranslateIcuCallback, TranslateChildrenCallback } from './runtime';
import { GT } from 'generaltranslation';

export type GTContextType = {
  gt: GT;
  registerIcuForTranslation: TranslateIcuCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  _tFunction: (
    message: string,
    options: InlineTranslationOptions,
    preloadedTranslations: Translations | undefined
  ) => string;
  _mFunction: (
    message: string,
    options: InlineTranslationOptions,
    preloadedTranslations: Translations | undefined,
    hashSet: Map<string, _Message> | undefined
  ) => string;
  _filterMessagesForPreload: (_messages: _Messages) => _Messages;
  _preloadMessages: (_messages: _Messages) => Promise<Translations>;
  _dictionaryFunction: (
    id: string,
    options?: DictionaryTranslationOptions
  ) => string;
  developmentApiEnabled: boolean;
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
