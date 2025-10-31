import { Variable } from './variables';

/**
 * Map of data-_gt properties to their corresponding React props
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
 * GTProp is an internal property used to contain data for translating and rendering elements.
 * note, transformations are only read on the server side if they are 'plural' or 'branch'
 */
export type GTProp = {
  b?: Record<string, JsxChildren>; // Branches
  t?: 'p' | 'b'; // Branch Transformation
} & HtmlContentPropKeysRecord;

export type JsxElement = {
  t?: string; // tag name
  i?: number; // id
  d?: GTProp; // GT data
  c?: JsxChildren; // children
};

export type JsxChild = string | JsxElement | Variable;

/**
 * The format of the content
 */
export type DataFormat = 'JSX' | 'ICU' | 'I18NEXT';

/**
 * A content type representing JSX, ICU, and I18next messages
 */
export type Content = JsxChildren | IcuMessage | I18nextMessage;

/**
 * A content type representing JSX elements
 */
export type JsxChildren = JsxChild | JsxChild[];

/**
 * A content type representing ICU messages
 */
export type IcuMessage = string;

/**
 * A content type representing I18next messages
 */
export type I18nextMessage = string;
