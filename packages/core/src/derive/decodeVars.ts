import { traverseIcu } from './utils/traverseIcu';
import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';
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
export function decodeVars(icu: string): string {
  // Check if the string contains _gt_
  if (!icu.includes(RESERVED_NAME_PREFIX)) {
    return icu;
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

  // Find all variable identifiers.
  traverseIcu({
    icu,
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
    outputList.push(icu.slice(previousIndex, variableLocations[i].start));
    outputList.push(variableLocations[i].value);
    previousIndex = variableLocations[i].end;
  }
  if (previousIndex < icu.length) {
    outputList.push(icu.slice(previousIndex));
  }
  const outputString = outputList.join('');

  return outputString;
}
