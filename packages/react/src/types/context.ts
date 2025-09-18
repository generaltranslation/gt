import {
  Translations,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
  _Messages,
  TFunctionType,
  MFunctionType,
  Dictionary,
  DictionaryEntry,
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
  _mFunction: <T extends string | null | undefined>(
    encodedMsg: T,
    options?: Record<string, any>,
    preloadedTranslations?: Translations
  ) => T extends string ? string : T;
  _filterMessagesForPreload: (_messages: _Messages) => _Messages;
  _preloadMessages: (_messages: _Messages) => Promise<Translations>;
  _dictionaryFunction: (
    id: string,
    options?: DictionaryTranslationOptions
  ) => string;
  _dictionaryObjFunction: (
    id: string,
    idWithParent: string,
    options?: DictionaryTranslationOptions
  ) => Dictionary | DictionaryEntry | string | undefined;
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
