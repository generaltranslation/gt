import {
  Variable,
  VariableTransformationSuffix,
  TransformationPrefix,
  GTProp,
  VariableType,
} from 'generaltranslation/types';
import React from 'react';

/**
 * TaggedElement is a React element with a GTProp property.
 */
export type GTTag = {
  id: number;
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
  [key: string]: unknown;
};
export type DictionaryEntry = Entry | [Entry] | [Entry, MetaEntry];
export type Dictionary = {
  [key: string]: Dictionary | DictionaryEntry;
};
export type FlattenedDictionary = {
  [key: string]: DictionaryEntry;
};

// ----- TRANSLATION ----- //

/**
 * Translated content types
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

export type DictionaryTranslationOptions = Record<string, any>;
export type InlineTranslationOptions = DictionaryTranslationOptions & {
  $context?: string;
  $id?: string;
  $hash?: string;
  $string?: string;
};
export type RuntimeTranslationOptions = {
  locale?: string;
} & Omit<InlineTranslationOptions, 'id'>;

export type VariableProps = {
  variableType: VariableType;
  variableValue: any;
  variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
  variableName: string;
};

export type RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
}: Omit<VariableProps, 'variableName'> & {
  locales: string[];
}) => React.JSX.Element;

export type _Message = {
  message: string;
  hash?: string;
  id?: string;
  context?: string;
};
export type _Messages = _Message[];
