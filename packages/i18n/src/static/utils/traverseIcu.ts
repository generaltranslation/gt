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
 * Given an ICU string, traverse the AST and call the visitor function for each element that matches the type T
 * @param icu - The ICU string to traverse
 * @param shouldVisit - A function that returns true if the element should be visited
 * @param visitor - A function that is called for each element that matches the type T
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
}): void {
  const ast = parse(icuString, otherOptions);
  handleChildren(ast);

  function handleChildren(children: MessageFormatElement[]): void {
    children.map(handleChild);
  }

  function handleChild(child: MessageFormatElement) {
    // handle select var
    let visited = false;
    if (shouldVisit(child)) {
      visitor(child);
      visited = true;
    }
    // recurse on children
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
