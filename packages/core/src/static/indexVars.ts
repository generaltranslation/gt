import {
  MessageFormatElement,
  PluralOrSelectOption,
  SelectElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser';

import { VAR_IDENTIFIER } from './utils/constants';
import { traverseIcu } from './utils/traverseIcu';
import { GTUnindexedSelectElement } from './utils/types';
import { isGTUnindexedSelectElement } from './utils/traverseHelpers';

// Used for temporarily tracking variable indices in the AST
const VAR_FLAG_SUFFIX = '_flag';
const VAR_FLAG_REGEX = new RegExp(`^${VAR_IDENTIFIER}\\d+${VAR_FLAG_SUFFIX}$`);

interface GTFlaggedSelectElement extends SelectElement {
  type: TYPE.select;
  value: `${typeof VAR_IDENTIFIER}${number}${typeof VAR_FLAG_SUFFIX}`;
  options: {
    other: PluralOrSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}

type Location = {
  start: number;
  end: number;
  otherStart: number;
  otherEnd: number;
};

/**
 * Given an ICU string adds identifiers to each _gt_ placeholder
 * indexVars('Hello {_gt_} {_gt_} World') => 'Hello {_gt_1_} {_gt_2_} World'
 */
export function indexVars(icuString: string): string {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return icuString;
  }

  // Record the location of the variable
  const variableLocations: Location[] = [];
  function visitor(child: GTUnindexedSelectElement): void {
    variableLocations.push({
      start: child.location?.start.offset ?? 0,
      end: child.location?.end.offset ?? 0,
      otherStart: child.options.other.location?.start.offset ?? 0,
      otherEnd: child.options.other.location?.end.offset ?? 0,
    });
  }

  // Find all variable identifiers
  traverseIcu({
    icuString,
    shouldVisit: isGTUnindexedSelectElement,
    visitor,
    options: { recurseIntoVisited: false, captureLocation: true },
  });

  // Index each variable and collapse the other option
  const result = [];
  let current = 0;
  for (let i = 0; i < variableLocations.length; i++) {
    const { start, end, otherStart, otherEnd } = variableLocations[i];
    // Before the variable
    result.push(icuString.slice(current, start));
    console.log("'" + icuString.slice(current, start) + "'");
    // Replace the variable with the new identifier (+1 is for the curly brace)
    result.push(icuString.slice(start, start + VAR_IDENTIFIER.length + 1));
    console.log(
      "'" + icuString.slice(start, start + VAR_IDENTIFIER.length + 1) + "'"
    );
    // Add the new identifier
    result.push(String(i + 1));
    console.log("'" + String(i + 1) + "'");
    // After the variable
    result.push(icuString.slice(start + VAR_IDENTIFIER.length + 1, otherStart));
    console.log(
      "'" + icuString.slice(start + VAR_IDENTIFIER.length + 1, otherStart) + "'"
    );
    // Before the other option
    result.push('{}');
    console.log("'{}'");
    // The other option
    result.push(icuString.slice(otherEnd, end));
    console.log("'" + icuString.slice(otherEnd, end) + "'");
    current = end;
  }
  result.push(icuString.slice(current, icuString.length));

  return result.join('');
}
