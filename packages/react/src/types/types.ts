import React, { ReactElement } from 'react';

export type Child = React.ReactNode;
export type Children = Child[] | Child;
export type GTProp = {
  id: number;
  transformation?: string;
  children?: Children;
} & Record<string, any>;

export type TaggedChild = React.ReactNode | TaggedElement;
export type TaggedChildren = TaggedChild[] | TaggedChild;
export type TaggedElementProps = Record<string, any> & { 'data-_gt': GTProp };
export type TaggedElement = React.ReactElement<TaggedElementProps>;

export type TaggedEntry = string | TaggedChildren;
export type TaggedDictionaryEntry =
  | TaggedEntry
  | [TaggedEntry]
  | [TaggedEntry, Metadata];
export type TaggedDictionary = {
  [key: string]: TaggedDictionary | TaggedDictionaryEntry;
};
export type FlattenedTaggedDictionary = {
  [key: string]: TaggedDictionaryEntry;
};

export type Entry = string | ReactElement;
export type Metadata = {
  singular?: Entry;
  plural?: Entry;
  zero?: Entry;
  dual?: Entry;
  one?: Entry;
  two?: Entry;
  few?: Entry;
  many?: Entry;
  other?: Entry;
  context?: string;
  variablesOptions?: Record<string, any>;
  [key: string]: any;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, Metadata];
export type Dictionary = {
  [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};

export type Variable = {
  key: string;
  id?: number;
  variable?: 'variable' | 'number' | 'datetime' | 'currency';
};

export type TranslatedElement = {
  type: string;
  props: {
    'data-_gt': {
      id: number;
      [key: string]: any;
    };
    children?: TranslatedChildren;
  };
};

export type TranslatedChild = TranslatedElement | string | Variable;
export type TranslatedChildren = TranslatedChild | TranslatedChild[];
export type TranslatedContent = string | (string | Variable)[];

export type TranslationError = {
  state: 'error';
  error: string;
  code?: number;
};
export type TranslationSuccess = {
  state: 'success';
  target: TranslatedChildren | TranslatedContent; // target
};
export type TranslationLoading = {
  state: 'loading';
};

export type TranslationsObject = {
  [key: string]: TranslationSuccess | TranslationLoading | TranslationError;
};

// maps locales to translation objects
export type LocalesTranslations = {
  [locale: string]: TranslationsObject | null;
};

export type RenderMethod = 'skeleton' | 'replace' | 'default';

export type TranslateContentCallback = (params: {
  source: any;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;
export type TranslateChildrenCallback = (params: {
  source: any;
  targetLocale: string;
  metadata: { hash: string; context?: string } & Record<string, any>;
}) => Promise<TranslationSuccess | TranslationLoading | TranslationError>;

export type GTContextType = {
  getDictionaryEntryTranslation: (
    id: string,
    options?: Record<string, any>
  ) => React.ReactNode;
  translateContent: TranslateContentCallback;
  translateJsx: TranslateChildrenCallback;
  getContentTranslation: (
    content: string,
    id: string,
    options: Record<string, any>,
    metadata: Record<string, any>
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

export class GTTranslationError extends Error {
  constructor(
    public error: string,
    public code: number
  ) {
    super(error);
    this.code = code;
  }

  toTranslationError(): TranslationError {
    return {
      state: 'error',
      error: this.error,
      code: this.code,
    };
  }
}

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
