import type * as t from '@babel/types';
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
