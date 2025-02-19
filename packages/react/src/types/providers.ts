import {
  TranslateContentCallback,
  TranslateChildrenCallback,
  TranslationsObject,
  RenderMethod,
  FlattenedTaggedDictionary,
  TranslatedChildren,
} from './types';

export type GTContextType = {
  getDictionaryEntryTranslation: (
    id: string,
    options?: Record<string, any>
  ) => React.ReactNode;
  translateContent: TranslateContentCallback;
  translateJsx: TranslateChildrenCallback;
  getContentTranslation: (
    content: string,
    options: Record<string, any>
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
