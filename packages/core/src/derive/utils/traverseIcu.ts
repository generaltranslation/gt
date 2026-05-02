import {
  MessageFormatElement,
  parse,
  ParserOptions,
  TYPE,
} from '@formatjs/icu-messageformat-parser';

type TraverseIcuOptions = ParserOptions & {
  recurseIntoVisited?: boolean;
};

/**
 * Traverses an ICU AST and calls the visitor for each element that matches type T.
 * @param icuString - The ICU string to traverse.
 * @param shouldVisit - Function that returns true if the element should be visited.
 * @param visitor - Function called for each matching element.
 * @returns The modified AST of the ICU string.
 *
 * @note This function is expensive; use it sparingly.
 */
export function traverseIcu<T extends MessageFormatElement>({
  icuString,
  shouldVisit,
  visitor,
  options: { recurseIntoVisited = true, ...otherOptions },
}: {
  icuString: string;
  shouldVisit: (element: MessageFormatElement) => element is T;
  visitor: (element: T) => void;
  options: TraverseIcuOptions;
}): MessageFormatElement[] {
  const ast = parse(icuString, otherOptions);
  handleChildren(ast);
  return ast;

  function handleChildren(children: MessageFormatElement[]): void {
    children.map(handleChild);
  }

  function handleChild(child: MessageFormatElement) {
    // Visit matching elements.
    let visited = false;
    if (shouldVisit(child)) {
      visitor(child);
      visited = true;
    }
    // Recurse into children.
    if (!visited || recurseIntoVisited) {
      if (child.type === TYPE.select || child.type === TYPE.plural) {
        Object.values(child.options)
          .map((option) => option.value)
          .map(handleChildren);
      } else if (child.type === TYPE.tag) {
        handleChildren(child.children);
      }
    }
  }
}
