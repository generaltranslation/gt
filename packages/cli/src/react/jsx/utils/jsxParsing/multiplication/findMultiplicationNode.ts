import {
  WhitespaceJsxTreeResult,
  WhitespaceMultiplicationNode,
  isWhitespaceMultiplicationNode,
  isWhitespaceJsxTree,
} from '../types.js';

export type MultiplicationNodeResult = {
  parent: any | undefined;
  key: string | undefined;
  node: WhitespaceMultiplicationNode;
};

/**
 * Finds the immediate multiplication node from the given root (eg no nested multiplication nodes)
 * TODO: I am sure there is some optimization to be done here
 *
 * Maybe there is an optimization here with caching used paths btwn calls
 */
export function findMultiplicationNode(
  root:
    | WhitespaceJsxTreeResult
    | WhitespaceMultiplicationNode
    | (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[]
): MultiplicationNodeResult | undefined {
  // Entry point
  return handleChildren(root, undefined, undefined);

  // Helper function to handle children
  function handleChildren(
    curr:
      | WhitespaceJsxTreeResult
      | WhitespaceMultiplicationNode
      | (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[],
    parent: any | undefined,
    key: string | undefined
  ): MultiplicationNodeResult | undefined {
    if (Array.isArray(curr)) {
      for (const [index, child] of Object.entries(curr)) {
        const result = handleChild(child, curr, index);
        if (result) return result;
      }
      return undefined;
    } else {
      return handleChild(curr, parent, key);
    }
  }

  // Helper function to handle a single child
  function handleChild(
    curr: WhitespaceJsxTreeResult | WhitespaceMultiplicationNode,
    parent: any | undefined,
    key: string | undefined
  ): MultiplicationNodeResult | undefined {
    if (isWhitespaceMultiplicationNode(curr)) {
      return { parent, key, node: curr };
    } else if (isWhitespaceJsxTree(curr)) {
      if (curr.props?.children) {
        return handleChildren(curr.props.children, curr.props, 'children');
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
}
