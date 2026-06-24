import type { StringExpressionNode } from '../types';

export function stringNodeToVariants(node: StringExpressionNode): string[] {
  const values = stringNodeToStaticValues(node);
  return values ?? [];
}

export function stringNodeToStaticValues(
  node: StringExpressionNode
): string[] | undefined {
  if (node.type === 'static') {
    return [node.value];
  }

  if (node.type === 'dynamic' || node.type === 'derive') {
    return undefined;
  }

  if (node.type === 'choice') {
    const values: string[] = [];
    for (const branch of node.branches) {
      const branchValues = stringNodeToStaticValues(branch);
      if (!branchValues) {
        return undefined;
      }
      values.push(...branchValues);
    }
    return [...new Set(values)];
  }

  const partValues = node.nodes.map((part) => stringNodeToStaticValues(part));
  if (partValues.some((values) => values === undefined)) {
    return undefined;
  }

  return cartesianProduct(partValues as string[][]);
}

function cartesianProduct(arrays: string[][]): string[] {
  if (arrays.length === 0) {
    return [''];
  }

  return arrays.reduce<string[]>(
    (values, nextValues) =>
      values.flatMap((value) =>
        nextValues.map((nextValue) => value + nextValue)
      ),
    ['']
  );
}
