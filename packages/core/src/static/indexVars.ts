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

  // // Unfortunately when serializing AST, we lose whitespace formatting, so we need to use this workaround
  // // Escape all _gt_ by appending _escape_ suffix and a numeric index
  // const splitIcuString = icuString.split(VAR_IDENTIFIER);
  // const combinedIcuList = [];
  // for (let listIndex = 0; listIndex < splitIcuString.length; listIndex++) {
  //   combinedIcuList.push(splitIcuString[listIndex]);
  //   if (listIndex < splitIcuString.length - 1) {
  //     combinedIcuList.push(
  //       `${VAR_IDENTIFIER}${2 * listIndex + 1}${VAR_FLAG_SUFFIX}`
  //     );
  //   }
  // }
  // const escapedIcuString = combinedIcuList.join('');

  // // index start at 1, parity with GTJSON identifiers
  // let index = 1;

  // // Helper function to check if the child is a variable
  // function isGTFlaggedSelectElement(
  //   child: MessageFormatElement
  // ): child is GTFlaggedSelectElement {
  //   return (
  //     child.type === TYPE.select &&
  //     VAR_FLAG_REGEX.test(child.value) &&
  //     !!child.options.other &&
  //     (child.options.other.value.length === 0 ||
  //       (child.options.other.value.length > 0 &&
  //         child.options.other.value[0]?.type === TYPE.literal))
  //   );
  // }

  // // Helper function to update the variable index
  // function visitor(child: GTFlaggedSelectElement): void {
  //   // Note the index of the variable in the list
  //   const listIndex = Number.parseInt(
  //     child.value.slice(VAR_IDENTIFIER.length, -VAR_FLAG_SUFFIX.length)
  //   );
  //   combinedIcuList[listIndex] = `${VAR_IDENTIFIER}${index}`;
  //   index += 1;
  // }

  // // Find all variable identifiers
  // traverseIcu({
  //   icuString: escapedIcuString,
  //   shouldVisit: isGTFlaggedSelectElement,
  //   visitor,
  //   options: {
  //     recurseIntoVisited: false,
  //   },
  // });

  // // Reconstruct the ICU string, now with identifiers, filter out the escape suffix
  // return combinedIcuList
  //   .map((part, listIndex) =>
  //     listIndex % 2 === 0
  //       ? part
  //       : part.replace(`${listIndex}${VAR_FLAG_SUFFIX}`, '')
  //   )
  //   .join('');
}
