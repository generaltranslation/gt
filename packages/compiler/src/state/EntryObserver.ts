import type * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import type { Content } from '@generaltranslation/format/types';

/** Translation APIs whose entries the collection pass finds. */
export type EntryApi = 'T' | 'gt' | 't' | 'msg';

/**
 * Where a piece of source-locale text sits in the AST: `container[key]` is the
 * text expression.
 */
export type TextSite = {
  container: object;
  key: string | number;
};

/** An entry with a compile-time hash, and the call that carries it. */
export type CollectedEntry = {
  api: EntryApi;
  /** Compile-time hash, equal to the CLI's hash */
  hash: string;
  /** Source-locale content: the ICU/STRING message or minified JSX children */
  source: Content;
  /**
   * The call carrying the entry: the `jsx(T, props)` call for `<T>`, the
   * `gt(...)` / `t(...)` / `msg(...)` call for strings
   */
  node: t.CallExpression;
  /**
   * For `<T>`: the text children and text props (html content props, branch
   * text) inside its children. String APIs keep their text in argument 0.
   */
  textSites?: TextSite[];
};

/**
 * Why an entry has no compile-time hash:
 * - `derive`: derive(), <Derive>/<Static> or autoderive content, or a derive
 *   `$context`; its hash is only known at runtime
 * - `taggedTemplate`: a t`...` tagged template the macro did not expand
 */
export type RuntimeHashedReason = 'derive' | 'taggedTemplate';

/** An entry whose hash is only computed at runtime. */
export type RuntimeHashedEntry = {
  api: EntryApi;
  reason: RuntimeHashedReason;
  node: t.Node;
};

/**
 * Observes the translatable entries the collection and injection passes find,
 * with where their source text sits in the AST. Build extensions implement it
 * (`TransformExtension.observer`); a regular build has none.
 */
export interface EntryObserver {
  /** An entry with a compile-time hash. */
  add(entry: CollectedEntry): void;
  /** An entry whose hash is only known at runtime. */
  addRuntimeHashed(entry: RuntimeHashedEntry): void;
  /**
   * Runs `fn` (the construction of one `<T>`'s children) and returns the
   * text sites reported while it ran.
   */
  captureTextSites<R>(fn: () => R): { result: R; textSites: TextSite[] };
  /** A source-text expression found while building `<T>` children. */
  recordTextSite(path: NodePath): void;
  /** A text-valued object property (an html content prop) of `<T>` children. */
  recordTextProperty(property: t.ObjectProperty): void;
  /** The `message` property of an injected useGT prefetch item. */
  recordPrefetchMessage(hash: string, property: t.ObjectProperty): void;
}
