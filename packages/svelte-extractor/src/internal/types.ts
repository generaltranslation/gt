import type { JsxChildren } from '@generaltranslation/format/types';

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
  instance?: { content: { body: SvelteNode[] } } | null;
  module?: { content: { body: SvelteNode[] } } | null;
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
 * - `b`: per element snippet name, the Branch/Plural kind and its source branch names.
 */
export type GTRuntimeMetadata = {
  v?: Record<string, Record<string, number>>;
  b?: Record<string, { t: 'p' | 'b'; b: string[] }>;
};

/** One analyzed `<T>` call site. */
export type TranslationSite = {
  /** Serialized JSX children, identical to what React produces. */
  source: JsxChildren;
  /** Translation lookup hash. */
  hash: string;
  metadata: TranslationMetadata;
  location: SourceLocation;
};

/** One `gt()` / `msg()` string call site. */
export type StringSite = {
  source: string;
  hash: string;
  metadata: TranslationMetadata;
  location: SourceLocation;
};

export type SvelteAnalysis = {
  translations: TranslationSite[];
  strings: StringSite[];
  errors: SvelteExtractionError[];
};
