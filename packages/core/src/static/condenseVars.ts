import {
  ArgumentElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser/types';
import { printAST } from '@formatjs/icu-messageformat-parser/printer';
import { traverseIcu } from './utils/traverseIcu';
import { VAR_IDENTIFIER } from './utils/constants';
import { GTIndexedSelectElement } from './utils/types';
import { isGTIndexedSelectElement } from './utils/traverseHelpers';
interface GTIndexedArgumentElement extends ArgumentElement {
  value: `${typeof VAR_IDENTIFIER}${number}`;
}

/**
 * Given an indexed ICU string, condenses any select to an argument
 * indexVars('Hello {_gt_1, select, other {World}}') => 'Hello {_gt_1}'
 * @param {string} icuString - The ICU string to condense.
 * @returns {string} The condensed ICU string.
 */
export function condenseVars(icuString: string): string {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return icuString;
  }

  // Replace with argument
  function visitor(child: GTIndexedSelectElement): void {
    (child as unknown as GTIndexedArgumentElement).type = TYPE.argument;
    delete (child as any).options;
  }

  const ast = traverseIcu({
    icuString,
    shouldVisit: isGTIndexedSelectElement,
    visitor,
    options: { recurseIntoVisited: false },
  });

  // Serialize
  return printAST(ast);
}
