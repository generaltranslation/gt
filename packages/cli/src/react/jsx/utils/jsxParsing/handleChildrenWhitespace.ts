import { isAcceptedPluralForm } from 'generaltranslation/internal';
import {
  ElementNode,
  ExpressionNode,
  isElementNode,
  isExpressionNode,
  isMultiplicationNode,
  isWhitespaceMultiplicationNode,
  JsxTree,
  MultiplicationNode,
  WhitespaceJsxTreeResult,
  WhitespaceMultiplicationNode,
} from './types.js';

// JSX whitespace characters (space, tab, newline, carriage return)
// Does NOT include non-breaking space (U+00A0) which should be preserved
const isJsxWhitespace = (char: string) => {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
};

const trimJsxWhitespace = (
  str: string,
  side: 'start' | 'end' | 'both' = 'both'
) => {
  let start = 0;
  let end = str.length;

  if (side === 'start' || side === 'both') {
    while (start < end && isJsxWhitespace(str[start])) {
      start++;
    }
  }

  if (side === 'end' || side === 'both') {
    while (end > start && isJsxWhitespace(str[end - 1])) {
      end--;
    }
  }

  return str.slice(start, end);
};

const hasNonJsxWhitespace = (str: string) => {
  for (const char of str) {
    if (!isJsxWhitespace(char)) return true;
  }
  return false;
};

export function trimJsxStringChild(child: string) {
  if (!child.includes('\n') && !child.includes('\r')) {
    return child;
  }

  // Normalize line endings to \n for consistency across platforms
  let result = child.replace(/\r\n|\r/g, '\n');

  // Collapse multiple spaces/tabs into a single space (but not nbsp)
  result = result.replace(/[\t ]+/g, ' ');

  let newResult = '';
  let newline = false;
  for (const char of result) {
    if (char === '\n') {
      if (hasNonJsxWhitespace(newResult)) newResult += ' ';
      else newResult = '';
      newline = true;
      continue;
    }
    if (!newline) {
      newResult += char;
      continue;
    }
    if (isJsxWhitespace(char)) continue;
    newResult += char;
    newline = false;
  }
  if (newline) newResult = trimJsxWhitespace(newResult, 'end');
  result = newResult;
  // Collapse multiple spaces/tabs into a single space (but not nbsp)
  result = result.replace(/[\t ]+/g, ' ');
  return result;
}

// Overload for when currentTree is an array
export function handleChildrenWhitespace(
  currentTree: MultiplicationNode['branches'],
  parentNodeType: 'multiplication'
): (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[];

// Overload for when currentTree is an array
export function handleChildrenWhitespace(
  currentTree: MultiplicationNode['branches'],
  parentNodeType?: 'element' | 'expression' | undefined
):
  | WhitespaceJsxTreeResult
  | WhitespaceMultiplicationNode
  | (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[];

// Overload for when currentTree is not an array
export function handleChildrenWhitespace(
  currentTree: MultiplicationNode | JsxTree,
  parentNodeType?: 'multiplication' | 'element' | 'expression' | undefined
): null | WhitespaceJsxTreeResult | WhitespaceMultiplicationNode;

// Overload for entry point
export function handleChildrenWhitespace(
  currentTree: JsxTree | JsxTree[]
): null | WhitespaceJsxTreeResult | WhitespaceJsxTreeResult[];
/**
 * Handles whitespace in children of a JSX element, and strips elements
 * @param currentTree - The current tree to handle
 * @returns The processed tree with whitespace handled
 *
 * For unresolved functions, we just make it so that Static has no children
 *
 * The typing was so much worse before this. Don't come for me. All I did was enforce the typing.
 */
export function handleChildrenWhitespace(
  currentTree: MultiplicationNode | JsxTree | MultiplicationNode['branches'],
  parentNodeType:
    | 'multiplication'
    | 'element'
    | 'expression'
    | undefined = undefined
):
  | null
  | WhitespaceJsxTreeResult
  | WhitespaceMultiplicationNode
  | (WhitespaceJsxTreeResult | WhitespaceMultiplicationNode)[] {
  if (Array.isArray(currentTree)) {
    const childrenTypes: (
      | 'text'
      | 'element'
      | 'expression'
      | 'multiplication'
      | 'other'
    )[] = currentTree.map((child) => {
      if (typeof child === 'string') return 'text';
      if (isExpressionNode(child)) return 'expression';
      if (isElementNode(child)) return 'element';
      if (isMultiplicationNode(child)) return 'multiplication';
      return 'other';
    });
    const newChildren: (
      | WhitespaceJsxTreeResult
      | WhitespaceMultiplicationNode
    )[] = [];
    currentTree.forEach((child, index) => {
      switch (childrenTypes[index]) {
        case 'text':
          const textNode = child as string;
          if (parentNodeType === 'multiplication') {
            // This should be treated like a new tree (no parent here b/c its a new tree)
            const result = handleChildrenWhitespace(textNode);
            if (result) newChildren.push(result);
          } else {
            const string = trimJsxStringChild(textNode);
            if (string) newChildren.push(string);
          }
          break;
        case 'expression':
          // Strip expressions
          const result = (child as ExpressionNode).result;
          if (isMultiplicationNode(result)) {
            newChildren.push(handleChildrenWhitespace(result));
          } else if (typeof result === 'string') {
            newChildren.push(result);
          } else {
            // other case
            newChildren.push(result);
          }
          break;
        case 'element':
          const newElement = handleChildrenWhitespace(
            child as ElementNode | null
          );
          newChildren.push(newElement);
          break;
        case 'multiplication':
          // I dont think this case is possible, at least in the array case
          // Can only be child of element or multiplication nodes
          newChildren.push({
            nodeType: 'multiplication',
            branches: handleChildrenWhitespace(
              (child as MultiplicationNode).branches,
              'multiplication'
            ),
          });
          break;
        case 'other':
          // Return number or boolean or null
          newChildren.push(child as number | boolean | null);
          break;
      }
    });
    if (parentNodeType === 'multiplication') {
      // Return the branches as an array
      return newChildren;
    }
    return newChildren.length === 1 ? newChildren[0] : newChildren;
  } else if (isElementNode(currentTree)) {
    // Process all props recursively
    // What if there is a different component sharing the same name?
    const elementIsPlural = currentTree.type === 'Plural';
    const elementIsBranch = currentTree.type === 'Branch';
    const processedProps = !currentTree.props
      ? undefined
      : Object.fromEntries(
          Object.entries(currentTree.props).map(
            ([key, value]:
              | [string, any]
              | [
                  'children',
                  (
                    | JsxTree
                    | MultiplicationNode
                    | (JsxTree | MultiplicationNode)[]
                  ),
                ]): [string, any] => {
              let shouldProcess = false;
              // Process children
              if (key === 'children') shouldProcess = true;
              // Process plural children
              if (elementIsPlural && isAcceptedPluralForm(key as string))
                shouldProcess = true;
              // Process branch children
              if (elementIsBranch && key !== 'branch') shouldProcess = true;
              // Do not process raw strings
              if (typeof value === 'string' && key !== 'children')
                shouldProcess = false;
              // Process props
              if (!shouldProcess) {
                return [key, value];
              }
              return [key, handleChildrenWhitespace(value)];
            }
          )
        );
    return {
      nodeType: 'element',
      type: currentTree.type,
      ...(processedProps ? { props: processedProps } : {}),
    };
  } else if (isExpressionNode(currentTree)) {
    // Strip expression
    const result = (currentTree as ExpressionNode).result;
    if (isMultiplicationNode(result)) {
      return handleChildrenWhitespace(result);
    } else if (typeof result === 'string') {
      return result;
    } else {
      return result;
    }
  } else if (isMultiplicationNode(currentTree)) {
    return {
      nodeType: 'multiplication',
      branches: handleChildrenWhitespace(
        currentTree.branches,
        'multiplication'
      ),
    };
  } else if (typeof currentTree === 'string') {
    return trimJsxStringChild(currentTree);
  }
  // null or number or boolean
  return currentTree;
}
