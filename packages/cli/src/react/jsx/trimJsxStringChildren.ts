import { isAcceptedPluralForm } from 'generaltranslation/internal';

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

export function trimJsxStringChild(
  child: string,
  index: number,
  childrenTypes: ('expression' | 'text' | 'element')[]
) {
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

/**
 * Handles whitespace in children of a JSX element.
 * @param currentTree - The current tree to handle
 * @returns The processed tree with whitespace handled
 */
export const handleChildrenWhitespace = (currentTree: any): any => {
  if (Array.isArray(currentTree)) {
    const childrenTypes: ('text' | 'element' | 'expression')[] =
      currentTree.map((child) => {
        if (typeof child === 'string') return 'text';
        if (typeof child === 'object' && 'expression' in child)
          return 'expression';
        return 'element';
      });
    const newChildren: any[] = [];
    currentTree.forEach((child, index) => {
      if (childrenTypes[index] === 'text') {
        const string = trimJsxStringChild(child, index, childrenTypes);
        if (string) newChildren.push(string);
      } else if (childrenTypes[index] === 'expression') {
        newChildren.push(child.result);
      } else {
        newChildren.push(handleChildrenWhitespace(child));
      }
    });
    return newChildren.length === 1 ? newChildren[0] : newChildren;
  } else if (currentTree?.props) {
    // Process all props recursively
    const elementIsPlural = currentTree.type === 'Plural';
    const elementIsBranch = currentTree.type === 'Branch';
    const processedProps = Object.fromEntries(
      Object.entries(currentTree.props).map(([key, value]) => {
        let shouldProcess = false;
        if (key === 'children') shouldProcess = true;
        if (elementIsPlural && isAcceptedPluralForm(key as string))
          shouldProcess = true;
        if (elementIsBranch && key !== 'branch') shouldProcess = true;
        // Add your validation logic here
        if (shouldProcess) {
          return [key, handleChildrenWhitespace(value)];
        }
        return [key, value];
      })
    );

    return {
      ...currentTree,
      props: processedProps,
    };
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
