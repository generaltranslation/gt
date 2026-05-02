import { Variable } from './variables';

/**
 * Maps data-_gt properties to their corresponding React props.
 */
export const HTML_CONTENT_PROPS = {
  pl: 'placeholder',
  ti: 'title',
  alt: 'alt',
  arl: 'aria-label',
  arb: 'aria-labelledby',
  ard: 'aria-describedby',
} as const;

export type HtmlContentPropKeysRecord = Partial<
  Record<keyof typeof HTML_CONTENT_PROPS, string>
>;
export type HtmlContentPropValuesRecord = Partial<
  Record<(typeof HTML_CONTENT_PROPS)[keyof typeof HTML_CONTENT_PROPS], string>
>;

/**
 * GTProp contains internal data for translating and rendering elements.
 * Transformations are only read on the server side when they are 'plural' or 'branch'.
 */
export type GTProp = {
  b?: Record<string, JsxChildren>; // Branches.
  t?: 'p' | 'b'; // Branch transformation.
} & HtmlContentPropKeysRecord;

export type JsxElement = {
  t?: string; // Tag name.
  i?: number; // ID.
  d?: GTProp; // GT data.
  c?: JsxChildren; // Children.
};

export type JsxChild = string | JsxElement | Variable;

/**
 * The format of string content.
 */
export type StringFormat = 'ICU' | 'I18NEXT' | 'STRING';

/**
 * The format of the content.
 */
export type DataFormat = 'JSX' | StringFormat;

/**
 * String format content.
 */
export type StringContent = IcuMessage | StringMessage | I18nextMessage;

/**
 * A content type representing JSX, ICU, and I18next messages.
 */
export type Content = JsxChildren | StringContent;

/**
 * A content type representing JSX elements.
 */
export type JsxChildren = JsxChild | JsxChild[];

/**
 * A content type representing ICU messages.
 */
export type IcuMessage = string;

/**
 * A content type representing I18next messages.
 */
export type I18nextMessage = string;

/**
 * A content type representing plain strings.
 */
export type StringMessage = string;
