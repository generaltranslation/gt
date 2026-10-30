import type * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import type { Content } from '@generaltranslation/format/types';

/** Translation APIs whose entries can be attributed to a module. */
export type LocaleTwinEntryApi = 'T' | 'gt' | 't' | 'msg';

/**
 * Where a piece of source-locale text sits in the AST: `container[key]` is the
 * text expression. Stripping replaces it with an empty string literal in
 * place, so sibling positions (and GT element indices) don't change.
 */
export type LocaleTwinTextSite = {
  container: object;
  key: string | number;
};

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
  /**
   * For `<T>`: the text children and text props (html content props, branch
   * text) inside its children. String APIs strip their first argument.
   */
  textSites?: LocaleTwinTextSite[];
};

/**
 * Why an entry keeps its source text in client code:
 * - `derive`: derive(), <Derive>/<Static> or autoderive content, or a derive
 *   `$context`; its hash is only known at runtime
 * - `customHash`: a user-supplied hash that is not a compile-time hash
 * - `taggedTemplate`: a t`...` tagged template the macro did not expand
 *   (no `$_hash` in code)
 * - `importSource`: the module's GT import source does not support locale
 *   twins (gt-next)
 * - `call`: the call cannot carry the locale twin marker (more than two
 *   arguments, or `<T>` props that are not an object literal)
 */
export type LocaleTwinUnattributedReason =
  | 'derive'
  | 'customHash'
  | 'taggedTemplate'
  | 'importSource'
  | 'call';

/** An entry that is not attributed to the module, so it keeps its text. */
export type LocaleTwinUnattributedEntry = {
  api: LocaleTwinEntryApi;
  reason: LocaleTwinUnattributedReason;
  node: t.Node;
};

const ENTRY_HASH_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Collects the entries of one module for the locale twins pass: attributed
 * entries (each call site gets a placeholder in client builds) and the ones
 * the compiler cannot attribute. Entries are recorded during the collection
 * pass, in source order, with their AST nodes so later passes can act on them.
 */
export class LocaleTwinCollector {
  private entries: LocaleTwinEntry[] = [];
  private unattributed: LocaleTwinUnattributedEntry[] = [];
  private textCapture: LocaleTwinTextSite[] | undefined;
  private prefetchMessages: { hash: string; site: LocaleTwinTextSite }[] = [];

  /**
   * Record an attributed entry. An entry whose hash is not a compile-time
   * hash (a user-supplied hash in another format) is recorded as unattributed.
   */
  add(entry: LocaleTwinEntry): void {
    if (!ENTRY_HASH_PATTERN.test(entry.hash)) {
      this.addUnattributed({
        api: entry.api,
        reason: 'customHash',
        node: entry.node,
      });
      return;
    }
    this.entries.push(entry);
  }

  /** Record an entry the compiler cannot attribute to the module. */
  addUnattributed(entry: LocaleTwinUnattributedEntry): void {
    this.unattributed.push(entry);
  }

  /**
   * Every entry that keeps its source text in code, in source order. When
   * `supported` is false (the module's GT import source does not support
   * locale twins, so the pass skipped it), the attributed entries are
   * included with reason `importSource`.
   */
  getUnattributed(supported: boolean): LocaleTwinUnattributedEntry[] {
    const unsupported: LocaleTwinUnattributedEntry[] = supported
      ? []
      : this.entries.map(({ api, node }) => ({
          api,
          node,
          reason: 'importSource',
        }));
    return [...this.unattributed, ...unsupported].sort(
      (a, b) => (a.node.start ?? 0) - (b.node.start ?? 0)
    );
  }

  /**
   * Moves an attributed entry to the unattributed ones (its call cannot
   * carry the locale twin marker, so it keeps its text).
   */
  unattribute(
    entry: LocaleTwinEntry,
    reason: LocaleTwinUnattributedReason
  ): void {
    this.entries = this.entries.filter((candidate) => candidate !== entry);
    this.addUnattributed({ api: entry.api, reason, node: entry.node });
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

  /**
   * Records the text sites reported by {@link recordTextSite} while `fn`
   * runs (the construction of one `<T>`'s children) and returns them.
   */
  captureTextSites<R>(fn: () => R): {
    result: R;
    textSites: LocaleTwinTextSite[];
  } {
    const previous = this.textCapture;
    const textSites: LocaleTwinTextSite[] = [];
    this.textCapture = textSites;
    try {
      return { result: fn(), textSites };
    } finally {
      this.textCapture = previous;
    }
  }

  /** Reports a source-text expression found while building `<T>` children. */
  recordTextSite(path: NodePath): void {
    if (!this.textCapture || path.key == null) return;
    this.textCapture.push({
      container: path.container as object,
      key: path.key,
    });
  }

  /** Records the `message` property of an injected useGT prefetch item. */
  recordPrefetchMessage(hash: string, property: t.ObjectProperty): void {
    this.prefetchMessages.push({
      hash,
      site: { container: property, key: 'value' },
    });
  }

  /** Text sites of injected prefetch messages whose entry is attributed. */
  getAttributedPrefetchMessages(): LocaleTwinTextSite[] {
    const sources = this.getSources();
    return this.prefetchMessages
      .filter(({ hash }) => hash in sources)
      .map(({ site }) => site);
  }

  /** Reports a text-valued object property (an html content prop). */
  recordTextProperty(property: t.ObjectProperty): void {
    this.textCapture?.push({ container: property, key: 'value' });
  }
}
