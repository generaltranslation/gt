import {
  Translations,
  RenderMethod,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
  TranslationResultStatus,
} from './types';
import {
  TranslateIcuCallback,
  TranslateChildrenCallback,
  TranslateI18nextCallback,
} from './runtime';
import { GT } from 'generaltranslation';

export type GTContextType = {
  gt: GT;
  registerI18nextForTranslation: TranslateI18nextCallback;
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
  translations: Translations | null;
  translationResultStatus: TranslationResultStatus | null;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  renderSettings: { method: RenderMethod; timeout?: number };
  projectId?: string;
};
