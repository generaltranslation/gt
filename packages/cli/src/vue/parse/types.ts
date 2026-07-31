import type { Updates } from '../../types/index.js';
import type { SourceLocation } from '@vue/compiler-dom';

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
  stringFunctions: Map<string, StringFunctionKind>;
};

export type ExtractionLocation = Pick<SourceLocation, 'start' | 'end'>;

export type VueExtractionContext = {
  errors: string[];
  file: string;
  includeSourceCodeContext: boolean;
  relativeFile: string;
  updates: Updates;
  warnings: Set<string>;
};
