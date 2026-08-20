import { EventType, IncrementalSource } from '@rrweb/types';
import type { eventWithTime } from '@rrweb/types';

// Shared view of rrweb's serialized DOM nodes + the GT hash a node carries. Used by
// both harvest strategies to walk the recorded tree.

/** The subset of rrweb's serialized-node shape the harvest reads. */
export type SerializedNode = {
  type: number;
  id: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
};

/** rrweb node type for a text node. */
export const TEXT_NODE = 3;

/** Every recorded text node (rrweb id → text) across the FullSnapshot + mutations. */
export function collectRecordedText(
  events: eventWithTime[]
): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (n: SerializedNode | undefined) => {
    if (!n) return;
    if (
      n.type === TEXT_NODE &&
      typeof n.textContent === 'string' &&
      n.textContent.trim()
    ) {
      map.set(n.id, n.textContent);
    }
    n.childNodes?.forEach(walk);
  };
  for (const e of events) {
    if (e.type === EventType.FullSnapshot) {
      walk(e.data.node as SerializedNode);
    } else if (
      e.type === EventType.IncrementalSnapshot &&
      e.data.source === IncrementalSource.Mutation
    ) {
      for (const add of e.data.adds) walk(add.node as SerializedNode);
      for (const t of e.data.texts) {
        if (typeof t.value === 'string' && t.value.trim())
          map.set(t.id, t.value);
      }
    }
  }
  return map;
}

/**
 * The message hash a node carries, or null. Two tag-ids mechanisms exist: the runtime
 * wrapper renders `data-_gt` (a `hashMessage` string on a `display:contents` span), and
 * the SWC transform renders `data-_gt-hash`; we accept either. GT's INTERNAL `data-_gt`
 * is an object prop that never reaches the DOM, so it never appears here — but we still
 * reject a non-string / `[object …]` value defensively.
 */
export function hashOf(n: SerializedNode): string | null {
  const a = n.attributes;
  if (!a) return null;
  const raw = a['data-_gt-hash'] ?? a['data-_gt'];
  if (typeof raw !== 'string') return null;
  const h = raw.trim();
  if (!h || h.startsWith('[object')) return null;
  return h;
}
