import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import type { LocaleTwinTextSite } from '../../state/LocaleTwinCollector';

/**
 * Removes the source-locale text of every attributed entry from the module
 * (client builds in locale twins mode). The text travels in the call site's
 * placeholder instead, which each locale twin fills with that locale's
 * content.
 *
 * Each text expression is replaced in place by `""`, never removed, so the
 * shape of the code (elements, props, variables, array positions, GT element
 * indices) is unchanged:
 * - `gt()` / `t()` / `msg()`: the first argument
 * - injected `useGT([...])` / `getGT([...])` prefetch items: `message`
 * - `<T>`: text children, html content props, and Branch/Plural text
 */
export function stripSourceText(state: TransformState): void {
  for (const entry of state.localeTwins.getEntries()) {
    if (entry.api === 'T') {
      for (const site of entry.textSites ?? []) blank(site);
    } else if (entry.node.arguments.length > 0) {
      blank({ container: entry.node.arguments, key: 0 });
    }
  }
  for (const site of state.localeTwins.getAttributedPrefetchMessages()) {
    blank(site);
  }
}

function blank({ container, key }: LocaleTwinTextSite): void {
  (container as Record<string | number, t.Node>)[key] = t.stringLiteral('');
}
