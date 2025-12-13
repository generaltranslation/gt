import { VAR_IDENTIFIER } from './utils/constants';
import { isGTIndexedSelectElement } from './utils/traverseHelpers';
import { traverseIcu } from './utils/traverseIcu';
import { GTIndexedSelectElement } from './utils/types';
/**
 * Given an indexed ICU string, extracts all the _gt_# variables and returns a mapping of the variable to the values
 *
 * extractVars('Hello {_gt_1, select, other {World}}') => { _gt_1: 'World' }
 *
 * @param {string} icuString - The ICU string to extract variables from.
 * @returns {Record<string, string>} A mapping of the variable to the value.
 */
export function extractVars(icuString: string): Record<string, string> {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return {};
  }

  // Extract all the _gt_# variables
  const variables: Record<string, string> = {};
  function visitor(child: GTIndexedSelectElement): void {
    variables[child.value] = child.options.other.value.length
      ? child.options.other.value[0]?.value
      : '';
  }

  traverseIcu({
    icuString,
    shouldVisit: isGTIndexedSelectElement,
    visitor,
    options: { recurseIntoVisited: false },
  });

  return variables;
}
