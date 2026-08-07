import type { VueExtractionResult } from '../types.js';
import type { ImplicitSlotWhitespace } from './vueCompiler.js';

export type GTComponentName =
  | 'T'
  | 'Var'
  | 'Num'
  | 'DateTime'
  | 'Currency'
  | 'Plural'
  | 'Branch';

/** Vue builtins whose runtime identity changes rich-content traversal. */
export type VueBuiltinName = 'Fragment' | 'Suspense';

export type StringFunctionKind = 'gt' | 'messages' | 'msg' | 't';
export type TemplateContainerKind = 'array' | 'object';

export type TemplateBindings = {
  /** Lengths of statically known, non-mutated array paths. */
  arrayLengths: Map<string, number>;
  /** Callable bindings that may return a GT or Vue component identity. */
  componentFactories: Set<string>;
  components: Map<string, GTComponentName>;
  /** Statically known container paths available to template expressions. */
  containerKinds: Map<string, TemplateContainerKind>;
  /** Container paths whose immediate runtime value may be a GT component. */
  possibleGTContainers: Set<string>;
  /** Callable paths whose returned container may directly contain `<T>`. */
  gtContainerFactories: Set<string>;
  /** Program bindings whose identity takes precedence over registrations. */
  directBindings: Set<string>;
  /** GT identities registered through an Options API `components` object. */
  registeredComponents: Map<string, GTComponentName>;
  /** Vue builtin identities registered through an Options API object. */
  registeredVueBuiltins: Map<string, VueBuiltinName>;
  staticValues: Map<string, string | number | bigint | boolean | null>;
  /** Vue identity helpers such as `markRaw`. */
  identityFunctions: Set<string>;
  /** Statically visible string alternatives for non-singleton expressions. */
  possibleStaticStrings: Map<string, Set<string>>;
  stringFunctions: Map<string, StringFunctionKind>;
  /** Callable aliases that may resolve to a gt-vue string function. */
  uncertainStringFunctions: Set<string>;
  /** Component aliases whose runtime identity escaped static analysis. */
  uncertainComponents: Set<string>;
  /** Direct aliases that can specifically resolve to a GT component. */
  uncertainGTComponents: Set<string>;
  /** Callable bindings that may specifically return a GT component. */
  gtComponentFactories: Set<string>;
  /** Uncertain identities originating in an Options API registration. */
  uncertainRegisteredComponents: Set<string>;
  /** Uncertain GT identities originating in an Options API registration. */
  uncertainRegisteredGTComponents: Set<string>;
  /** Statically proven local aliases of Vue builtins. */
  vueBuiltins: Map<string, VueBuiltinName>;
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
  /** Whitespace predicate used by the resolved consumer Vue compiler. */
  implicitSlotWhitespace: ImplicitSlotWhitespace;
  includeSourceCodeContext: boolean;
  relativeFile: string;
  results: VueExtractionResult[];
  source: string;
  surroundingLineCount: number;
  /** Variable component nodes whose public shape was already validated. */
  validatedVariableComponents: WeakSet<object>;
  warnings: Set<string>;
};
