import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { isCount } from './getPluralBranch';

function getTransformation(type: unknown): string | undefined {
  // Reading a property of a client reference throws in a server component.
  try {
    return typeof type === 'function'
      ? (type as { _gtt?: string })._gtt
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Gives each `<N>` in a plural's branch the count it shows. A nested
 * `<Plural>` gives its own. A branch with no `<N>` is returned as it is.
 */
export function fillCount(branch: ReactNode, n: unknown): ReactNode {
  if (!isCount(n)) return branch;
  const fill = (node: ReactNode): ReactNode => {
    if (Array.isArray(node)) {
      const filled = node.map(fill);
      return filled.every((child, index) => child === node[index])
        ? node
        : Children.toArray(filled);
    }
    if (!isValidElement<Record<string, unknown>>(node)) return node;
    const transformation = getTransformation(node.type);
    if (transformation?.startsWith('variable-count')) {
      return cloneElement(node, { children: n });
    }
    if (transformation?.startsWith('plural')) return node;
    // A <Branch> keeps its named branches in its props.
    const names = transformation?.startsWith('branch')
      ? Object.keys(node.props)
      : ['children'];
    const filled = names
      .map((name) => [name, fill(node.props[name] as ReactNode)] as const)
      .filter(([name, value]) => value !== node.props[name]);
    return filled.length
      ? cloneElement(node, Object.fromEntries(filled))
      : node;
  };
  return fill(branch);
}
