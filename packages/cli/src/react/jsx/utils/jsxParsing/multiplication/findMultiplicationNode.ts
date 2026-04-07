import {
  WhitespaceJsxTreeResult,
  WhitespaceMultiplicationNode,
  isWhitespaceMultiplicationNode,
  isWhitespaceJsxTree,
} from '../types.js';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  PLURAL_COMPONENT,
  BRANCH_COMPONENT,
  BRANCH_CONTROL_PROPS,
} from '../../constants.js';

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
      if (!curr.props) return undefined;

      // Check children first
      if (curr.props.children) {
        const result = handleChildren(
          curr.props.children,
          curr.props,
          'children'
        );
        if (result) return result;
      }

      // For Plural/Branch, also search translatable content props
      // Mirrors the prop filtering in handleChildrenWhitespace.ts and autoInsertion.ts
      const elementIsPlural = curr.type === PLURAL_COMPONENT;
      const elementIsBranch = curr.type === BRANCH_COMPONENT;
      if (elementIsPlural || elementIsBranch) {
        for (const [propKey, propValue] of Object.entries(curr.props)) {
          if (propKey === 'children') continue;
          if (typeof propValue === 'string') continue;
          if (elementIsPlural && !isAcceptedPluralForm(propKey)) continue;
          if (elementIsBranch && BRANCH_CONTROL_PROPS.has(propKey)) continue;
          if (propValue && typeof propValue === 'object') {
            const result = handleChildren(propValue, curr.props, propKey);
            if (result) return result;
          }
        }
      }

      return undefined;
    } else {
      return undefined;
    }
  }
}
