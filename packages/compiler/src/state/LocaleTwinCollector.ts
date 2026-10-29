import type * as t from '@babel/types';
import type { Content } from '@generaltranslation/format/types';

/** Translation APIs whose entries can be attributed to a module. */
export type LocaleTwinEntryApi = 'T' | 'gt' | 't' | 'msg';

/**
 * An entry attributed to the module being transformed: its compile-time hash,
 * its source-locale content, and the call that carries it in code.
 */
export type LocaleTwinEntry = {
  api: LocaleTwinEntryApi;
  /** Compile-time hash (16 lowercase hex), equal to the CLI's hash */
  hash: string;
  /** Source-locale content: the ICU/STRING message or minified JSX children */
  source: Content;
  /**
   * The call carrying the entry: the `jsx(T, props)` call for `<T>`, the
   * `gt(...)` / `t(...)` / `msg(...)` call for strings
   */
  node: t.CallExpression;
};

const ENTRY_HASH_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Collects the entries attributed to one module for the locale twins
 * registration call. Entries are recorded during the collection pass, in
 * source order, with their AST nodes so later passes can act on them.
 */
export class LocaleTwinCollector {
  private entries: LocaleTwinEntry[] = [];

  /**
   * Record an attributed entry. Entries without a well-formed hash (derive
   * content, user-supplied hashes in another format) are not attributable
   * and are ignored.
   */
  add(entry: LocaleTwinEntry): void {
    if (!ENTRY_HASH_PATTERN.test(entry.hash)) return;
    this.entries.push(entry);
  }

  /** Every attributed entry, in source order (hashes may repeat). */
  getEntries(): readonly LocaleTwinEntry[] {
    return this.entries;
  }

  /** Source content keyed by hash (first occurrence wins). */
  getSources(): Record<string, Content> {
    const sources: Record<string, Content> = {};
    for (const entry of this.entries) {
      if (!(entry.hash in sources)) sources[entry.hash] = entry.source;
    }
    return sources;
  }
}
