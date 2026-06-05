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
