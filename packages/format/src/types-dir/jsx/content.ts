import type { MessageTree } from '@generaltranslation/icu';
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
 * The format of the string content
 */
export type StringFormat = 'ICU' | 'I18NEXT' | 'STRING';

/**
 * The shape of content in each data format. A value alone does not tell its
 * format apart (ICU, I18next and plain messages are all strings, and an array
 * of strings is both JSX children and a message tree), so pair content with
 * its format where the difference matters.
 */
export type ContentByFormat = {
  JSX: JsxChildren;
  ICU: IcuMessage;
  I18NEXT: I18nextMessage;
  STRING: StringMessage;
  ICU_TREE: MessageTree;
};

/**
 * The format of the content.
 */
export type DataFormat = keyof ContentByFormat;

/**
 * The content of the given data formats.
 */
export type ContentFor<F extends DataFormat> = ContentByFormat[F];

/**
 * String format content.
 */
export type StringContent = ContentFor<StringFormat>;

/**
 * Content in any data format: what translation catalogs store.
 */
export type Content = ContentFor<DataFormat>;

/**
 * GT's persisted rich-content wire format.
 *
 * React preserves scalar boolean and null children, including nested element
 * content and Branch or Plural alternatives. Arrays omit those empty-rendering
 * primitives through React's child normalization.
 */
export type JsxChildren = boolean | null | JsxChild | JsxChild[];

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
