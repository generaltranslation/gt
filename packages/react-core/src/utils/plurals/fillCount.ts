import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { getMarker } from '../marker';
import { COUNT_VARIABLE_TYPE } from '../variables/_getVariableProps';

/**
 * Gives each `<N>` in a plural's branch the count it shows. A nested
 * `<Plural>` or `<Ordinal>` gives its own. A branch with no `<N>` is returned
 * as it is.
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
    const marker = getMarker(node.type);
    if (
      marker?.kind === 'variable' &&
      marker.variableType === COUNT_VARIABLE_TYPE
    )
      return cloneElement(node, { _count: n });
    if (marker?.kind === 'plural' || marker?.kind === 'ordinal') return node;
    // A <Branch> keeps its named branches in its props.
    const names =
      marker?.kind === 'branch' ? Object.keys(node.props) : ['children'];
    const filled = names
      .map((name) => [name, fill(node.props[name] as ReactNode)] as const)
      .filter(([name, value]) => !Object.is(value, node.props[name]));
    return filled.length
      ? cloneElement(node, Object.fromEntries(filled))
      : node;
  };
  return fill(branch);
}
