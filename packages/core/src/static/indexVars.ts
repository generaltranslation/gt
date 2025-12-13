import { printAST } from '@formatjs/icu-messageformat-parser/printer';
import { VAR_IDENTIFIER } from './utils/constants';
import { traverseIcu } from './utils/traverseIcu';
import { isGTUnindexedSelectElement } from './utils/traverseHelpers';
import {
  GTIndexedSelectElement,
  GTUnindexedSelectElement,
} from './utils/types';

/**
 * Given an ICU string adds identifiers to each _gt_ placeholder
 * indexVars('Hello {_gt_} {_gt_} World') => 'Hello {_gt_1} {_gt_2} World'
 */
export function indexVars(icuString: string): string {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return icuString;
  }

  // index start at 1, parity with GTJSON identifiers
  let index = 1;

  // Helper function to update the variable index
  function visitor(child: GTUnindexedSelectElement): void {
    (child as unknown as GTIndexedSelectElement).value =
      `${VAR_IDENTIFIER}${index}`;
    index += 1;
  }

  // Find all variable identifiers
  const ast = traverseIcu({
    icuString: icuString,
    shouldVisit: isGTUnindexedSelectElement,
    visitor,
    options: {
      recurseIntoVisited: false,
    },
  });

  // Serialize
  return printAST(ast);
}
