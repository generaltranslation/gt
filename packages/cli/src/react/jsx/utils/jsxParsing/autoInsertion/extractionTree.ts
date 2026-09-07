import type {
  JsxTree,
  WhitespaceJsxTreeResult,
  WhitespaceMultiplicationNode,
} from '../types.js';

/**
 * The extraction view already applies the host's JSX whitespace rules. Remove
 * expression markers while retaining array shape, including singleton arrays.
 */
export function autoJsxExtractionTree(
  tree: JsxTree | JsxTree[]
):
  | WhitespaceJsxTreeResult
  | WhitespaceMultiplicationNode
  | (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[] {
  function visit(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    if (
      'nodeType' in node &&
      node.nodeType === 'expression' &&
      'result' in node
    )
      return visit(node.result);
    if (
      'nodeType' in node &&
      node.nodeType === 'multiplication' &&
      'branches' in node
    )
      return { ...node, branches: visit(node.branches) };
    if (
      'nodeType' in node &&
      node.nodeType === 'element' &&
      'props' in node &&
      node.props &&
      typeof node.props === 'object'
    ) {
      return {
        ...node,
        props: Object.fromEntries(
          Object.entries(node.props).map(([name, value]) => [
            name,
            visit(value),
          ])
        ),
      };
    }
    return node;
  }
  return visit(tree) as ReturnType<typeof autoJsxExtractionTree>;
}
