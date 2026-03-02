import { VAR_IDENTIFIER } from './utils/constants';
import { isGTUnindexedSelectElement } from './utils/traverseHelpers';
import { traverseIcu } from './utils/traverseIcu';
import { GTUnindexedSelectElement } from './utils/types';
/**
 * Given an unindexed ICU string, extracts all the _gt_ variables and an indexed mapping of the variable to the values
 *
 * extractVars('Hello {_gt_, select, other {World}}') => { _gt_1: 'World' }
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
  let index = 1;
  const variables: Record<string, string> = {};
  function visitor(child: GTUnindexedSelectElement): void {
    variables[child.value + index] = child.options.other.value.length
      ? child.options.other.value[0]?.value
      : '';
    index += 1;
  }

  traverseIcu({
    icuString,
    shouldVisit: isGTUnindexedSelectElement,
    visitor,
    options: { recurseIntoVisited: false },
  });

  return variables;
}
