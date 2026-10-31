import * as t from '@babel/types';
import type {
  LocaleTwinCollector,
  LocaleTwinTextSite,
} from '../state/LocaleTwinCollector';

/**
 * Removes the source-locale text of every attributed entry from the module
 * (client builds in locale twins mode). The text travels in the module's
 * placeholder instead, and the runtime renders it from the registry by hash.
 *
 * Each text expression is replaced in place by `""`, never removed, so the
 * shape of the code (elements, props, variables, array positions, GT element
 * indices) is unchanged:
 * - `gt()` / `t()` / `msg()`: the first argument
 * - injected `useGT([...])` / `getGT([...])` prefetch items: `message`
 * - `<T>`: text children, html content props, and Branch/Plural text
 */
export function stripSourceText(collector: LocaleTwinCollector): void {
  for (const entry of collector.getEntries()) {
    if (entry.api === 'T') {
      for (const site of entry.textSites ?? []) blank(site);
    } else if (entry.node.arguments.length > 0) {
      blank({ container: entry.node.arguments, key: 0 });
    }
  }
  for (const site of collector.getAttributedPrefetchMessages()) {
    blank(site);
  }
}

function blank({ container, key }: LocaleTwinTextSite): void {
  (container as Record<string | number, t.Node>)[key] = t.stringLiteral('');
}
