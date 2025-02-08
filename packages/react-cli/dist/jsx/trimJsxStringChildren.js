'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.handleChildrenWhitespace = void 0;
exports.trimJsxStringChild = trimJsxStringChild;
const internal_1 = require('generaltranslation/internal');
function trimJsxStringChild(child, index, childrenTypes) {
  // Normalize line endings to \n for consistency across platforms
  let result = child.replace(/\r\n|\r/g, '\n');
  // Collapse multiple spaces/tabs into a single space
  result = result.replace(/[\t ]+/g, ' ');
  let newResult = '';
  let newline = false;
  for (const char of result) {
    if (char === '\n') {
      if (newResult.trim()) newResult += ' ';
      else newResult = '';
      newline = true;
      continue;
    }
    if (!newline) {
      newResult += char;
      continue;
    }
    if (char.trim() === '') continue;
    newResult += char;
    newline = false;
  }
  if (newline) newResult = newResult.trimEnd();
  result = newResult;
  // Collapse multiple spaces/tabs into a single space
  result = result.replace(/[\t ]+/g, ' ');
  return result;
}
/**
 * Handles whitespace in children of a JSX element.
 * @param currentTree - The current tree to handle
 * @returns The processed tree with whitespace handled
 */
const handleChildrenWhitespace = (currentTree) => {
  if (Array.isArray(currentTree)) {
    const childrenTypes = currentTree.map((child) => {
      if (typeof child === 'string') return 'text';
      if (typeof child === 'object' && 'expression' in child)
        return 'expression';
      return 'element';
    });
    const newChildren = [];
    currentTree.forEach((child, index) => {
      if (childrenTypes[index] === 'text') {
        const string = trimJsxStringChild(child, index, childrenTypes);
        if (string) newChildren.push(string);
      } else if (childrenTypes[index] === 'expression') {
        newChildren.push(child.result);
      } else {
        newChildren.push((0, exports.handleChildrenWhitespace)(child));
      }
    });
    return newChildren.length === 1 ? newChildren[0] : newChildren;
  } else if (
    currentTree === null || currentTree === void 0 ? void 0 : currentTree.props
  ) {
    // Process all props recursively
    const elementIsPlural = currentTree.type === 'Plural';
    const elementIsBranch = currentTree.type === 'Branch';
    const processedProps = Object.fromEntries(
      Object.entries(currentTree.props).map(([key, value]) => {
        let shouldProcess = false;
        if (key === 'children') shouldProcess = true;
        if (elementIsPlural && (0, internal_1.isAcceptedPluralForm)(key))
          shouldProcess = true;
        if (elementIsBranch && key !== 'branch') shouldProcess = true;
        // Add your validation logic here
        if (shouldProcess) {
          return [key, (0, exports.handleChildrenWhitespace)(value)];
        }
        return [key, value];
      })
    );
    return Object.assign(Object.assign({}, currentTree), {
      props: processedProps,
    });
  } else if (
    typeof currentTree === 'object' &&
    'expression' in currentTree === true
  ) {
    return currentTree.result;
  } else if (typeof currentTree === 'string') {
    return trimJsxStringChild(currentTree, 0, ['text']);
  }
  return currentTree;
};
exports.handleChildrenWhitespace = handleChildrenWhitespace;
