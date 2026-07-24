import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Already-wired recognition for the provider swap, the JSX counterpart of the
 * next.config transform's "this export is already wrapped in withGTConfig, so
 * leave it alone".
 *
 * A partial migration keeps the source library's provider element and nests it
 * inside the `<GTProvider>` the layout pass inserts. When the user then converts
 * the files that forced the partial mode and re-runs `gt migrate` to finish the
 * teardown, the provider swap sees that retained element and renames it to
 * `GTProvider` — producing a SECOND GTProvider inside the first. That builds and
 * renders identically, so nothing catches it, but gt-next's dictionary is then
 * serialized twice into every page: exactly the duplicated payload the report's
 * teardown step promises the re-run removes (round-9 re-attack finding B4,
 * measured at 1,634 catalog-key occurrences before AND after the teardown
 * against 817 at baseline).
 *
 * So a provider element that already sits inside a GTProvider is unwrapped
 * (replaced by its own children) instead of renamed, and the existing
 * GTProvider stays the only one.
 *
 * Returns the subset of `providerElements` to unwrap. Every decision is taken
 * from the pre-mutation tree, so the caller may mutate in any order: an ancestor
 * that is itself a provider element counts as a GTProvider too, because it
 * either becomes one (it is renamed) or is unwrapped into the GTProvider that
 * made it a candidate; either way the descendant would end up nested inside one.
 */
export function planProviderUnwraps<P extends NodePath<t.JSXElement>>(
  providerElements: P[]
): Set<P> {
  const providerNodes = new Set<t.Node>(
    providerElements.map((providerPath) => providerPath.node)
  );
  const unwraps = new Set<P>();
  for (const providerPath of providerElements) {
    const enclosing = providerPath.findParent(
      (parent) =>
        parent.isJSXElement() &&
        (isGtProviderElement(parent.node) || providerNodes.has(parent.node))
    );
    if (enclosing) unwraps.add(providerPath);
  }
  return unwraps;
}

/** True for `<GTProvider …>` (the element gt migrate itself inserts). */
function isGtProviderElement(node: t.JSXElement): boolean {
  return t.isJSXIdentifier(node.openingElement.name, { name: 'GTProvider' });
}

/**
 * Replaces a JSX element with its own children. In a JSX children position the
 * children are spliced in directly; anywhere else (a ternary arm, an expression
 * container, a return argument) they have to stay ONE node or @babel/types
 * throws, so they are wrapped in a fragment.
 */
export function unwrapJsxElement(path: NodePath<t.JSXElement>): void {
  const children = path.node.children;
  const parent = path.parentPath;
  if (parent !== null && (parent.isJSXElement() || parent.isJSXFragment())) {
    if (children.length === 0) {
      path.remove();
    } else {
      path.replaceWithMultiple(children);
    }
    return;
  }
  path.replaceWith(
    t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children)
  );
}
