import {
  MultipliedTree,
  MultipliedTreeNode,
  WhitespaceJsxTree,
  WhitespaceJsxTreeResult,
  WhitespaceMultiplicationNode,
} from '../types.js';
import { findMultiplicationNode } from './findMultiplicationNode.js';

/**
 * Given a JSX tree, multiply the static function nodes
 */
export function multiplyJsxTree(
  tree: WhitespaceJsxTreeResult | WhitespaceJsxTreeResult[]
): MultipliedTreeNode[] {
  if (!Array.isArray(tree)) {
    return multiplyBranches([tree]);
  } else {
    // when tree is an array, this is just sibbling elements within the <T>, so we need to treat them as a single branch
    const wrapperElement: WhitespaceJsxTree = {
      nodeType: 'element',
      type: 'T',
      props: {
        children: tree,
      },
    };
    // Multiply the wrapper element
    const multipliedBranches = multiplyBranches([
      wrapperElement,
    ]) as MultipliedTree[];
    // Unwrap the branches
    return multipliedBranches.map((branch) => branch.props!.children!);
  }
}

/**
 * Given a list of branches, multiply recursively (DFS)
 * @param branches
 */
function multiplyBranches(
  branches: WhitespaceMultiplicationNode['branches']
): MultipliedTreeNode[] {
  // Queue of branches to process
  const branchQueue: (
    | WhitespaceMultiplicationNode['branches'][0]
    | MultipliedTreeNode
  )[] = branches;

  // Finalized branches
  const newBranches: MultipliedTreeNode[] = [];

  // Process branches until exhausted
  while (branchQueue.length) {
    // Pop the next branch
    const branch = branchQueue.shift() as
      | WhitespaceJsxTreeResult
      | WhitespaceMultiplicationNode;

    // Get closest multiplication node
    const currentNode = findMultiplicationNode(branch);

    // No multiplication nodes, just add the branch to the final list
    if (!currentNode) {
      newBranches.push(branch as MultipliedTreeNode);
      continue;
    }
    const { node, parent, key } = currentNode;

    // Recursive call
    const subBranches = multiplyBranches(node.branches);

    // For every sub branch, create a new cloned branch
    for (const subBranch of subBranches) {
      // Placeholder for the new branch
      let newBranch:
        | MultipliedTreeNode // <--- Final type (this gets popped off the queue)
        | WhitespaceJsxTreeResult
        | WhitespaceMultiplicationNode
        | undefined = undefined;

      // Create a clone of the original with the sub branch swapped in
      if (parent === undefined || key === undefined) {
        // This means the subBranch directly replaces the branch itself
        newBranches.push(subBranch);
      } else {
        // Replace the multiplication node with the sub branch
        parent[key] = subBranch;
        // eslint-disable-next-line no-undef
        newBranch = structuredClone(branch);
        // Add the new branch to the list
        branchQueue.push(newBranch);
      }
    }
  }

  return newBranches;
}
