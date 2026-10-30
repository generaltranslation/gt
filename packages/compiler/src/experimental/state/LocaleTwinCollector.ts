import type * as t from '@babel/types';
import type { Content } from '@generaltranslation/format/types';
import type { NodePath } from '@babel/traverse';
import type {
  CollectedEntry,
  EntryApi,
  EntryObserver,
  RuntimeHashedEntry,
  TextSite,
} from '../../state/EntryObserver';

export type {
  CollectedEntry as LocaleTwinEntry,
  EntryApi as LocaleTwinEntryApi,
  TextSite as LocaleTwinTextSite,
} from '../../state/EntryObserver';

/**
 * Why an entry keeps its source text in client code:
 * - `derive`: derive(), <Derive>/<Static> or autoderive content, or a derive
 *   `$context`; its hash is only known at runtime
 * - `customHash`: a user-supplied hash that is not a compile-time hash
 * - `taggedTemplate`: a t`...` tagged template the macro did not expand
 *   (no `$_hash` in code)
 * - `importSource`: the module's GT import source has no registration export
 *   (it is not an `/experimental` entry point)
 */
export type LocaleTwinUnattributedReason =
  | RuntimeHashedEntry['reason']
  | 'customHash'
  | 'importSource';

/** An entry that is not attributed to the module, so it keeps its text. */
export type LocaleTwinUnattributedEntry = {
  api: EntryApi;
  reason: LocaleTwinUnattributedReason;
  node: t.Node;
};

const ENTRY_HASH_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Collects the entries attributed to one module for the locale twins
 * registration call. Entries are recorded during the collection pass, in
 * source order, with their AST nodes so later passes can act on them.
 */
export class LocaleTwinCollector implements EntryObserver {
  private entries: CollectedEntry[] = [];
  private unattributed: LocaleTwinUnattributedEntry[] = [];
  private textCapture: TextSite[] | undefined;
  private prefetchMessages: { hash: string; site: TextSite }[] = [];

  /**
   * Record an attributed entry. An entry whose hash is not a compile-time
   * hash (a user-supplied hash in another format) is recorded as unattributed.
   */
  add(entry: CollectedEntry): void {
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

  /** An entry hashed only at runtime cannot be attributed. */
  addRuntimeHashed(entry: RuntimeHashedEntry): void {
    this.addUnattributed(entry);
  }

  /**
   * Every entry that keeps its source text in code, in source order. When
   * `registered` is false (the module got no registration call), the
   * attributed entries are included with reason `importSource`.
   */
  getUnattributed(registered: boolean): LocaleTwinUnattributedEntry[] {
    const unregistered: LocaleTwinUnattributedEntry[] = registered
      ? []
      : this.entries.map(({ api, node }) => ({
          api,
          node,
          reason: 'importSource',
        }));
    return [...this.unattributed, ...unregistered].sort(
      (a, b) => (a.node.start ?? 0) - (b.node.start ?? 0)
    );
  }

  /** Every attributed entry, in source order (hashes may repeat). */
  getEntries(): readonly CollectedEntry[] {
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
    textSites: TextSite[];
  } {
    const previous = this.textCapture;
    const textSites: TextSite[] = [];
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
  getAttributedPrefetchMessages(): TextSite[] {
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
