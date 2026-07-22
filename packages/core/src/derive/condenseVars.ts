import { printAST, TYPE, type ArgumentElement } from '@generaltranslation/icu';
import { traverseIcu } from './utils/traverseIcu';
import { VAR_IDENTIFIER } from './utils/constants';
import { GTIndexedSelectElement } from './utils/types';
import { isGTIndexedSelectElement } from './utils/traverseHelpers';
interface GTIndexedArgumentElement extends ArgumentElement {
  value: `${typeof VAR_IDENTIFIER}${number}`;
}

const CONTAINS_INDEXED_GT_REGEX = new RegExp(`${VAR_IDENTIFIER}\\d+`);

/**
 * Given an indexed ICU string, condenses any select to an argument
 * Unindexed _gt_ source strings and indexed _gt_# translation strings
 * are mutually exclusive.
 * indexVars('Hello {_gt_1, select, other {World}}') => 'Hello {_gt_1}'
 * @param {string} icuString - The ICU string to condense.
 * @returns {string} The condensed ICU string.
 */
export function condenseVars(icuString: string): string {
  // Check if the string contains an indexed _gt_ identifier.
  if (!CONTAINS_INDEXED_GT_REGEX.test(icuString)) {
    return icuString;
  }

  // Replace with argument
  function visitor(child: GTIndexedSelectElement): void {
    (child as unknown as GTIndexedArgumentElement).type = TYPE.argument;
    Reflect.deleteProperty(child, 'options');
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
