export const TYPE = {
  literal: 0,
  argument: 1,
  number: 2,
  date: 3,
  time: 4,
  select: 5,
  plural: 6,
  pound: 7,
  tag: 8,
} as const;

export type TYPE = (typeof TYPE)[keyof typeof TYPE];

export const SKELETON_TYPE = { number: 0, dateTime: 1 } as const;

export type SKELETON_TYPE = (typeof SKELETON_TYPE)[keyof typeof SKELETON_TYPE];

type ElementType<Name extends keyof typeof TYPE> = (typeof TYPE)[Name];
type SkeletonType<Name extends keyof typeof SKELETON_TYPE> =
  (typeof SKELETON_TYPE)[Name];

export interface LocationDetails {
  offset: number;
  line: number;
  column: number;
}

export interface Location {
  start: LocationDetails;
  end: LocationDetails;
}

export interface BaseElement<T extends TYPE> {
  type: T;
  value: string;
  location?: Location;
}

export type LiteralElement = BaseElement<ElementType<'literal'>>;
export type ArgumentElement = BaseElement<ElementType<'argument'>>;

export interface TagElement extends BaseElement<ElementType<'tag'>> {
  children: MessageFormatElement[];
}

export interface NumberSkeletonToken {
  stem: string;
  options: string[];
}

export interface ExtendedNumberFormatOptions extends Intl.NumberFormatOptions {
  scale?: number;
}

export interface NumberSkeleton {
  type: SkeletonType<'number'>;
  tokens: NumberSkeletonToken[];
  location?: Location;
  parsedOptions: ExtendedNumberFormatOptions;
}

export interface DateTimeSkeleton {
  type: SkeletonType<'dateTime'>;
  pattern: string;
  location?: Location;
  parsedOptions: Intl.DateTimeFormatOptions;
}

export type Skeleton = NumberSkeleton | DateTimeSkeleton;

export interface SimpleFormatElement<
  T extends TYPE,
  S extends Skeleton,
> extends BaseElement<T> {
  style?: string | S | null;
}

export type NumberElement = SimpleFormatElement<
  ElementType<'number'>,
  NumberSkeleton
>;
export type DateElement = SimpleFormatElement<
  ElementType<'date'>,
  DateTimeSkeleton
>;
export type TimeElement = SimpleFormatElement<
  ElementType<'time'>,
  DateTimeSkeleton
>;

export interface PluralOrSelectOption {
  value: MessageFormatElement[];
  location?: Location;
}

export interface SelectElement extends BaseElement<ElementType<'select'>> {
  options: Record<string, PluralOrSelectOption>;
}

export interface PluralElement extends BaseElement<ElementType<'plural'>> {
  options: Record<string, PluralOrSelectOption>;
  offset: number;
  pluralType: Intl.PluralRulesOptions['type'];
}

export interface PoundElement {
  type: ElementType<'pound'>;
  location?: Location;
}

export type MessageFormatElement =
  | ArgumentElement
  | DateElement
  | LiteralElement
  | NumberElement
  | PluralElement
  | PoundElement
  | SelectElement
  | TagElement
  | TimeElement;

export interface ParserOptions {
  ignoreTag?: boolean;
  requiresOtherClause?: boolean;
  shouldParseSkeletons?: boolean;
  captureLocation?: boolean;
  locale?: Intl.Locale;
}

export type MessageVariables = Record<string, unknown>;
