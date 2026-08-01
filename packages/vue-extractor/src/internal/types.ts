import type { VueExtractionResult } from '../types.js';

export type GTComponentName =
  | 'T'
  | 'Var'
  | 'Num'
  | 'DateTime'
  | 'Currency'
  | 'Plural'
  | 'Branch';

export type StringFunctionKind = 'gt' | 'messages' | 'msg';

export type TemplateBindings = {
  components: Map<string, GTComponentName>;
  /** Component names registered through an Options API `components` object. */
  registeredComponents: Set<string>;
  staticValues: Map<string, string | number | bigint | boolean | null>;
  stringFunctions: Map<string, StringFunctionKind>;
};

export type ExtractionPosition = {
  line: number;
  column: number;
  offset: number;
};

export type ExtractionLocation = {
  start: ExtractionPosition;
  end: ExtractionPosition;
};

export type VueExtractionContext = {
  errors: string[];
  file: string;
  includeSourceCodeContext: boolean;
  relativeFile: string;
  results: VueExtractionResult[];
  source: string;
  surroundingLineCount: number;
  warnings: Set<string>;
};
