export type Variable = {
  variable?: string;
  id?: string | number;
  key: string;
};

export type Content = string | Array<string | Variable>;

export type JsxElement = {
  type: string;
  props: {
    'data-_gt'?: {
      id: number;
      transformation?: string;
      branches?: Record<string, JsxChildren>;
    };
    children?: JsxChildren;
  };
};

export type JsxChild = string | JsxElement | Variable;
export type JsxChildren = JsxChild | JsxChild[];

type Metadata = {
  [key: string]: any;
};

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
