import type {
  Variable,
  GTProp,
  VariableType,
} from '@generaltranslation/format/types';
import type {
  VariableTransformationSuffix,
  TransformationPrefix,
  InjectionType,
} from 'generaltranslation/types';
import React from 'react';

export type {
  DictionaryTranslationOptions,
  GTFunctionType,
  InlineTranslationOptions,
  MFunctionType,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
export type { GTProp };

/**
 * TaggedElement is a React element with a GTProp property.
 */
export type GTTag = {
  id: number;
  injectionType: InjectionType;
  transformation?: TransformationPrefix;
  branches?: Record<string, TaggedChildren>;
  variableType?: VariableTransformationSuffix;
};
export type TaggedElementProps = Record<string, unknown> & {
  'data-_gt': GTTag;
  children?: TaggedChildren;
  branch?: string | number | boolean;
  n?: number;
  key?: React.Key;
};
export type TaggedElement = React.ReactElement<TaggedElementProps>;
export type TaggedChild =
  | Exclude<React.ReactNode, React.ReactElement>
  | TaggedElement;
export type TaggedChildren = TaggedChild[] | TaggedChild;

// ----- TRANSLATION ----- //

/**
 * Translated content types
 * TODO: move these types to JsxElement etc from generaltranslation/types
 * remember to omit the t property (tag name) from the translated element
 */
export type TranslatedElement = {
  i?: number;
  d?: GTProp;
  c?: TranslatedChildren;
};
export type TranslatedChild = TranslatedElement | string | Variable;
export type TranslatedChildren = TranslatedChild | TranslatedChild[];

// ----- DICTIONARY ----- //

export type Entry = string;
export type MetaEntry = {
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
  [key: string]: unknown;
};
export type Metadata = MetaEntry;
export type DictionaryEntry = Entry | [Entry] | [Entry, MetaEntry];
export type Dictionary =
  | {
      [key: string]: Dictionary | DictionaryEntry;
    }
  | (Dictionary | DictionaryEntry)[];
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};
export type DictionaryContent = string;
export type DictionaryObject = {
  [id: string]: DictionaryContent;
};
export type LocalesDictionary = {
  [locale: string]: DictionaryObject;
};
export type CustomLoader = (locale: string) => Promise<unknown>;

export type RelativeTimeFormatOptions = Intl.RelativeTimeFormatOptions & {
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
};
export type VariableProps = {
  /** Whether the variable was automatically injected by the compiler */
  variableType: VariableType;
  variableValue: unknown;
  variableOptions:
    | Intl.NumberFormatOptions
    | Intl.DateTimeFormatOptions
    | RelativeTimeFormatOptions;
  variableName: string;
  injectionType: InjectionType;
};

export type RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
  injectionType,
}: Omit<VariableProps, 'variableName'> & {
  locales: string[];
  enableI18n: boolean;
}) => React.ReactNode;

export type Translations = {
  [hash: string]: TranslatedChildren | null;
};
export type RenderMethod = 'skeleton' | 'replace' | 'default';
export type _Message = {
  message: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
};
export type _Messages = _Message[];
export type AuthFromEnvParams = {
  projectId?: string;
  devApiKey?: string;
};
export type AuthFromEnvReturn = {
  projectId: string;
  devApiKey?: string;
};
