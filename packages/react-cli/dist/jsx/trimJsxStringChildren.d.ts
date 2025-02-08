export declare function trimJsxStringChild(
  child: string,
  index: number,
  childrenTypes: ('expression' | 'text' | 'element')[]
): string;
/**
 * Handles whitespace in children of a JSX element.
 * @param currentTree - The current tree to handle
 * @returns The processed tree with whitespace handled
 */
export declare const handleChildrenWhitespace: (currentTree: any) => any;
