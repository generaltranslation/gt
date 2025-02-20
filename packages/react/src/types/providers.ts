import {
  TranslationsObject,
  RenderMethod,
  FlattenedTaggedDictionary,
  TranslatedChildren,
  TranslationOptions,
} from './types';

import { TranslateContentCallback, TranslateChildrenCallback } from './runtime';

export type GTContextType = {
  registerContentForTranslation: TranslateContentCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  translateContent: (content: string, options: TranslationOptions) => string;
  translateDictionaryEntry: (
    id: string,
    options?: TranslationOptions
  ) => React.ReactNode;
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

export type ClientProviderProps = {
  children: any;
  dictionary: FlattenedTaggedDictionary;
  initialTranslations: TranslationsObject;
  translationPromises: Record<string, Promise<TranslatedChildren>>;
  locale: string;
  locales: string[];
  _versionId?: string;
  dictionaryEnabled?: boolean;
  defaultLocale: string;
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
  requiredPrefix: string | undefined;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  runtimeTranslationEnabled: boolean;
  projectId?: string;
  devApiKey?: string;
  runtimeUrl?: string | null;
  onLocaleChange?: () => void;
  cookieName?: string;
};
