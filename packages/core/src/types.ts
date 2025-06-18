import { LocaleProperties } from './locales/getLocaleProperties';

export { LocaleProperties };

export type Content = string | Array<string | Variable>;

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
 * Transformations are made from a prefix and a suffix.
 */
export type Transformation =
  | 'translate-client'
  | 'translate-server'
  | 'variable-variable'
  | 'variable-currency'
  | 'variable-datetime'
  | 'variable-number'
  | 'plural'
  | 'branch';
export type TransformationPrefix =
  | 'translate'
  | 'variable'
  | 'plural'
  | 'branch'
  | 'fragment';
export type VariableTransformationSuffix =
  | 'variable'
  | 'number'
  | 'datetime'
  | 'currency';

/**
 * GTProp is an internal property used to contain data for translating and rendering elements.
 * note, transformations are only read on the server side if they are 'plural' or 'branch'
 */
export type GTProp = {
  id: number;
  variableType?: VariableType;
  b?: Record<string, JsxChildren>; // Branches
  t?: 'p' | 'b'; // Branch Transformation
} & HtmlContentPropKeysRecord;

export type JsxElement = {
  type: string;
  props: {
    'data-_gt'?: GTProp;
    children?: JsxChildren;
  };
};

export type JsxChild = string | JsxElement | Variable;
export type JsxChildren = JsxChild | JsxChild[];

export type Metadata = {
  context?: string;
  id?: string;
  sourceLocale?: string;
  actionType?: 'standard' | 'fast' | string;
  [key: string]: any;
};

export type DataFormat = 'JSX' | 'ICU' | 'I18NEXT';

export type FormatVariables = Record<
  string,
  string | number | boolean | null | undefined | Date
>;

export type Update =
  | {
      type: 'content';
      data: {
        source: Content;
        metadata: Metadata;
      };
    }
  | {
      type: 'jsx';
      data: {
        source: JsxChildren;
        metadata: Metadata;
      };
    };

export type Request =
  | {
      type: 'content';
      data: {
        source: Content;
        targetLocale: string;
        metadata: Metadata;
      };
    }
  | {
      type: 'jsx';
      data: {
        source: JsxChildren;
        targetLocale: string;
        metadata: Metadata;
      };
    };

export type ContentTranslationResult = {
  translation: Content;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type IcuTranslationResult = {
  translation: string;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type JsxTranslationResult = {
  translation: JsxChildren;
  locale: string;
  reference?: {
    id: string;
    key: string;
  };
};

export type TranslationError = {
  error: string;
  code: number;
  reference?: {
    id: string;
    key: string;
  };
};

export type { CustomMapping } from './locales/customLocaleMapping';

// ----- VARIABLES ----- //

export type VariableType =
  | 'v' // Variable
  | 'n' // Number
  | 'd' // Date
  | 'c'; // Currency

/**
 * Variables are used to store the variable name and type.
 */
export type Variable = {
  k: string;
  i?: number;
  v?: VariableType;
};
