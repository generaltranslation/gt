import type { Transformation } from 'generaltranslation/internal';
import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

function getTransformation(type: unknown): Transformation | undefined {
  // Reading a property of a client reference throws in a server component.
  try {
    return typeof type === 'function'
      ? (type as { _gtt?: Transformation })._gtt
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Gives each `<N>` in a plural's branch the count it shows. A nested
 * `<Plural>` gives its own. A branch with no `<N>` is returned as it is.
 */
export function fillCount(branch: ReactNode, n: number | bigint): ReactNode {
  const fill = (node: ReactNode): ReactNode => {
    if (Array.isArray(node)) {
      const filled = node.map(fill);
      // Object.is, so a NaN child does not count as a change.
      return filled.every((child, index) => Object.is(child, node[index]))
        ? node
        : Children.toArray(filled);
    }
    if (!isValidElement<Record<string, unknown>>(node)) return node;
    const transformation = getTransformation(node.type);
    // The component, or the one the compiler inserts for it.
    const is = (component: Transformation) =>
      transformation === component ||
      transformation === `${component}-automatic`;
    if (is('variable-count')) return cloneElement(node, { _count: n });
    if (is('plural')) return node;
    // A <Branch> keeps its named branches in its props.
    const names = is('branch') ? Object.keys(node.props) : ['children'];
    const filled = names
      .map((name) => [name, fill(node.props[name] as ReactNode)] as const)
      .filter(([name, value]) => !Object.is(value, node.props[name]));
    return filled.length
      ? cloneElement(node, Object.fromEntries(filled))
      : node;
  };
  return fill(branch);
}
