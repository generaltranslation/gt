import {
  Variable,
  VariableTransformationSuffix,
  TransformationPrefix,
  GTProp,
  VariableType,
  InjectionType,
} from 'generaltranslation/types';
import React from 'react';

export type {
  GTFunctionType,
  MFunctionType,
  InlineTranslationOptions,
  DictionaryTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';

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
export type TaggedElementProps = Record<string, any> & {
  'data-_gt': GTTag;
};
export type TaggedElement = React.ReactElement<TaggedElementProps>;
export type TaggedChild =
  | Exclude<React.ReactNode, React.ReactElement>
  | TaggedElement;
export type TaggedChildren = TaggedChild[] | TaggedChild;

/**
 * For dictionaries, we have Entry and MetaEntry
 */
export type Entry = string;
export type MetaEntry = {
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
  [key: string]: unknown;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, MetaEntry];
export type Dictionary =
  | {
      [key: string]: Dictionary | DictionaryEntry;
    }
  | (Dictionary | DictionaryEntry)[];
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};

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
export type Translations = {
  [hash: string]: TranslatedChildren | null;
};

// ----- DICTIONARY ----- //

// a user defined dict (e.g. a user provided translation)
/**
 * @deprecated use {@link Dictionary}
 */
export type DictionaryContent = string;

// maps dict ids to dict content
/**
 * @deprecated use {@link Dictionary}
 */
export type DictionaryObject = {
  [id: string]: DictionaryContent;
};

// maps locales to dict objects
export type LocalesDictionary = {
  [locale: string]: DictionaryObject;
};

export type CustomLoader = (locale: string) => Promise<any>;

export type RenderMethod = 'skeleton' | 'replace' | 'default';

export type VariableProps = {
  /** Whether the variable was automatically injected by the compiler */
  variableType: VariableType;
  variableValue: any;
  variableOptions:
    | Intl.NumberFormatOptions
    | Intl.DateTimeFormatOptions
    | (Intl.RelativeTimeFormatOptions & {
        unit?: Intl.RelativeTimeFormatUnit;
        baseDate?: Date;
      });
  variableName: string;
  injectionType: InjectionType;
};

export type RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  injectionType,
}: Omit<VariableProps, 'variableName'> & {
  locales: string[];
}) => React.ReactNode;

export type _Message = {
  message: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  $_hash?: string;
};
export type _Messages = _Message[];
