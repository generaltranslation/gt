import { traverseIcu } from './utils/traverseIcu';
import { VAR_IDENTIFIER } from './utils/constants';
import { GTUnindexedSelectElement } from './utils/types';
import { isGTUnindexedSelectElement } from './utils/traverseHelpers';

type Location = {
  start: number;
  end: number;
  value: string;
};

/**
 * Given an encoded ICU string, interpolate only _gt_ variables that have been marked with declareVar()
 * @example
 * const encodedIcu = "Hi" + declareVar("Brian") + ", my name is {name}"
 * // 'Hi {_gt_, select, other {Brian}}, my name is {name}'
 * decodeVars(encodedIcu)
 * // 'Hi Brian, my name is {name}'
 */
export function decodeVars(icuString: string): string {
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
      value:
        child.options.other.value.length > 0
          ? child.options.other.value[0].value
          : '',
    });
  }

  // Find all variable identifiers
  traverseIcu({
    icuString,
    shouldVisit: isGTUnindexedSelectElement,
    visitor,
    options: {
      recurseIntoVisited: false,
      captureLocation: true,
    },
  });

  // Construct output string
  let previousIndex = 0;
  const outputList = [];
  for (let i = 0; i < variableLocations.length; i++) {
    outputList.push(icuString.slice(previousIndex, variableLocations[i].start));
    outputList.push(variableLocations[i].value);
    previousIndex = variableLocations[i].end;
  }
  if (previousIndex < icuString.length) {
    outputList.push(icuString.slice(previousIndex));
  }
  const outputString = outputList.join('');

  return outputString;
}
