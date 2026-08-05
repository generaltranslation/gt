import type { JsxChildren } from '@generaltranslation/format/types';

/**
 * Version-neutral Vue compiler surface accepted by programmatic extraction.
 *
 * Vue's compiler AST types are nominally incompatible across even patch
 * releases. Keeping the callable members opaque lets an app pass its exact
 * `vue/compiler-sfc` module while runtime validation protects the boundary.
 */
export type VueCompiler = {
  /** Compiles one Vue SFC template. */
  compileTemplate: (...args: never[]) => unknown;
  /** Parses one Vue single-file component. */
  parse: (...args: never[]) => unknown;
  /** Optional exact compiler-dom parser for older Vue 3 releases. */
  parseTemplate?: (...args: never[]) => unknown;
  /** Exact Vue compiler release. */
  version: string;
};

/** Vue template compiler options that can change extracted source hashes. */
export type VueCompilerOptions = {
  /** Controls how Vue normalizes whitespace between template children. */
  whitespace?: 'condense' | 'preserve';
  /** Replaces Vue's default `{{` and `}}` interpolation delimiters. */
  delimiters?: [string, string];
};

/** Source lines captured around an extracted translation. */
export type VueSourceCode = {
  before: string;
  target: string;
  after: string;
};

/** Metadata attached to an extracted Vue translation. */
export type VueExtractionMetadata = {
  context?: string;
  filePaths?: string[];
  sourceCode?: Record<string, VueSourceCode[]>;
};

/** A translation extracted from Vue source code before CLI post-processing. */
export type VueExtractionResult =
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
      metadata: VueExtractionMetadata;
    }
  | {
      dataFormat: 'STRING';
      source: string;
      metadata: VueExtractionMetadata;
    };

/** Options that control extraction from one Vue source file. */
export type VueExtractionOptions = {
  /** Exact compiler used by the consuming Vue application. */
  compiler?: VueCompiler;
  /** Vue compiler options used by the consuming application. */
  compilerOptions?: VueCompilerOptions;
  /** Includes surrounding source lines in result metadata. */
  includeSourceCodeContext?: boolean;
  /** Root used to make metadata file paths relative. Defaults to `process.cwd()`. */
  projectRoot?: string;
  /** Number of source lines captured before and after a translation. */
  surroundingLineCount?: number;
};

/** Extraction output for one Vue single-file component or script. */
export type VueExtractionOutput = {
  results: VueExtractionResult[];
  errors: string[];
  warnings: string[];
};
