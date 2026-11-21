import type {
  Variable,
  GTProp,
  VariableType,
} from '@generaltranslation/format';
import type { GTConfig } from 'generaltranslation';
import React from 'react';

export type InjectionType = 'automatic' | 'manual';

/** What `addGTIdentifier()` records on an element of a `<T>`'s children. */
export type GTTag = {
  id: number;
  injectionType: InjectionType;
} & (
  | { transformation?: 'fragment' | 'derive' }
  | { transformation: 'variable'; variableType: VariableType }
  | {
      transformation: 'branch' | 'plural' | 'ordinal';
      branches?: Record<string, TaggedChildren>;
    }
);
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
 * TODO: move these types to JsxElement etc from @generaltranslation/format
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
  variableId: number;
  injectionType: InjectionType;
};

export type RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
  injectionType,
}: Omit<VariableProps, 'variableId'> & {
  locales: string[];
  enableI18n: boolean;
}) => React.ReactNode;

export type Translations = {
  [hash: string]: TranslatedChildren | null;
};
export type RenderMethod = NonNullable<GTConfig['renderSettings']>['method'];
