export enum TYPE {
  literal = 0,
  argument = 1,
  number = 2,
  date = 3,
  time = 4,
  select = 5,
  plural = 6,
  pound = 7,
  tag = 8,
}

export enum SKELETON_TYPE {
  number = 0,
  dateTime = 1,
}

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

export type LiteralElement = BaseElement<TYPE.literal>;
export type ArgumentElement = BaseElement<TYPE.argument>;

export interface TagElement extends BaseElement<TYPE.tag> {
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
  type: SKELETON_TYPE.number;
  tokens: NumberSkeletonToken[];
  location?: Location;
  parsedOptions: ExtendedNumberFormatOptions;
}

export interface DateTimeSkeleton {
  type: SKELETON_TYPE.dateTime;
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

export type NumberElement = SimpleFormatElement<TYPE.number, NumberSkeleton>;
export type DateElement = SimpleFormatElement<TYPE.date, DateTimeSkeleton>;
export type TimeElement = SimpleFormatElement<TYPE.time, DateTimeSkeleton>;

export interface PluralOrSelectOption {
  value: MessageFormatElement[];
  location?: Location;
}

export interface SelectElement extends BaseElement<TYPE.select> {
  options: Record<string, PluralOrSelectOption>;
}

export interface PluralElement extends BaseElement<TYPE.plural> {
  options: Record<string, PluralOrSelectOption>;
  offset: number;
  pluralType: Intl.PluralRulesOptions['type'];
}

export interface PoundElement {
  type: TYPE.pound;
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

export function isLiteralElement(
  element: MessageFormatElement
): element is LiteralElement {
  return element.type === TYPE.literal;
}

export function isArgumentElement(
  element: MessageFormatElement
): element is ArgumentElement {
  return element.type === TYPE.argument;
}

export function isNumberElement(
  element: MessageFormatElement
): element is NumberElement {
  return element.type === TYPE.number;
}

export function isDateElement(
  element: MessageFormatElement
): element is DateElement {
  return element.type === TYPE.date;
}

export function isTimeElement(
  element: MessageFormatElement
): element is TimeElement {
  return element.type === TYPE.time;
}

export function isSelectElement(
  element: MessageFormatElement
): element is SelectElement {
  return element.type === TYPE.select;
}

export function isPluralElement(
  element: MessageFormatElement
): element is PluralElement {
  return element.type === TYPE.plural;
}

export function isPoundElement(
  element: MessageFormatElement
): element is PoundElement {
  return element.type === TYPE.pound;
}

export function isTagElement(
  element: MessageFormatElement
): element is TagElement {
  return element.type === TYPE.tag;
}

export function isNumberSkeleton(
  style: NumberElement['style'] | Skeleton
): style is NumberSkeleton {
  return typeof style === 'object' && style?.type === SKELETON_TYPE.number;
}

export function isDateTimeSkeleton(
  style?: DateElement['style'] | TimeElement['style'] | Skeleton
): style is DateTimeSkeleton {
  return typeof style === 'object' && style?.type === SKELETON_TYPE.dateTime;
}
