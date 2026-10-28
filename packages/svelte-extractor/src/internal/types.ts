import type { JsxChildren, StringFormat } from '@generaltranslation/format';

/**
 * Minimal structural view of the Svelte 5 modern AST. Only the fields the
 * extractor reads are declared, so any compatible `svelte/compiler` version
 * can supply the parser.
 */
export type SvelteNode = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};

export type SvelteFragment = {
  type: 'Fragment';
  nodes: SvelteNode[];
};

export type SvelteAttributeValue =
  | true
  | SvelteNode
  | (SvelteNode & { data?: string; raw?: string })[];

export type SvelteAttribute = SvelteNode & {
  name: string;
  value: SvelteAttributeValue;
};

export type SvelteElementNode = SvelteNode & {
  name: string;
  name_loc?: { end: { character: number } };
  attributes: SvelteNode[];
  fragment: SvelteFragment;
};

export type SvelteRoot = {
  fragment: SvelteFragment;
  /** The top-level `<style>` element. */
  css?: { start: number; end: number } | null;
  instance?: { content: { body: SvelteNode[] } } | null;
  module?: { content: { body: SvelteNode[] } } | null;
  /** The `<svelte:options>` element. */
  options?: { preserveWhitespace?: boolean; namespace?: string } | null;
};

/** The `parse` function from `svelte/compiler`. */
export type SvelteParse = (
  source: string,
  options: { modern: true; filename?: string }
) => unknown;

/** Static `<T>` metadata that affects the hash or extracted catalog entry. */
export type TranslationMetadata = {
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

/** A source position for diagnostics. */
export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
};

/** A problem that prevents a `<T>` from being translated. */
export type SvelteExtractionError = {
  whatHappened: string;
  fix?: string;
  location: SourceLocation;
};

/**
 * Runtime metadata passed to `<T>` as `_gtm`.
 * - `v`: per scope, the variable key -> variable id map.
 * - `s`: per parent (a scoped element id, or `""` for `<T>` itself), the
 *   variable key -> variable id map of its child variables. Only emitted
 *   for keys used more than once in a scope.
 * - `b`: per scoped element id, the Branch/Plural kind and its source branch names.
 */
export type GTRuntimeMetadata = {
  v?: Record<string, Record<string, number>>;
  s?: Record<string, Record<string, number>>;
  b?: Record<string, { t: 'p' | 'b'; b: string[] }>;
};

/** Source lines around a call site, as the CLI uploads them. */
export type SourceCodeContext = {
  before: string;
  target: string;
  after: string;
};

/** One analyzed `<T>` call site. */
export type TranslationSite = {
  /** Serialized JSX children, identical to what React produces. */
  source: JsxChildren;
  /** Translation lookup hash. */
  hash: string;
  metadata: TranslationMetadata;
  location: SourceLocation;
  /** Present when `surroundingLineCount` is set. */
  sourceCode?: SourceCodeContext;
};

/** One `gt()` / `msg()` string call site. */
export type StringSite = {
  source: string;
  hash: string;
  /** The `$format` option: `ICU` unless the call selects another format. */
  dataFormat: StringFormat;
  metadata: TranslationMetadata;
  location: SourceLocation;
  /** Present when `surroundingLineCount` is set. */
  sourceCode?: SourceCodeContext;
};

export type SvelteAnalysis = {
  translations: TranslationSite[];
  strings: StringSite[];
  errors: SvelteExtractionError[];
  /** Problems that left content out of the extraction without failing it. */
  warnings: SvelteExtractionError[];
};
