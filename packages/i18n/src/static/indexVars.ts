import {
  MessageFormatElement,
  PluralOrSelectOption,
  SelectElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser';

import { VAR_IDENTIFIER } from './utils/constants';
import { traverseIcu } from './utils/traverseIcu';

// Used for temporarily tracking variable indices in the AST
const VAR_FLAG_SUFFIX = '_flag';
const VAR_FLAG_REGEX = new RegExp(`^${VAR_IDENTIFIER}\\d+${VAR_FLAG_SUFFIX}$`);

interface Variable extends SelectElement {
  type: TYPE.select;
  value: `${typeof VAR_IDENTIFIER}${number}${typeof VAR_FLAG_SUFFIX}`;
  options: {
    other: PluralOrSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}

/**
 * Given an ICU string adds identifiers to each _gt_ placeholder
 * indexVars('Hello {_gt_} {_gt_} World') => 'Hello {_gt_1_} {_gt_2_} World'
 */
export function indexVars(icuString: string): string {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return icuString;
  }

  // Unfortunately when serializing AST, we lose whitespace formatting, so we need to use this workaround
  // Escape all _gt_ by appending _escape_ suffix and a numeric index
  const splitIcuString = icuString.split(VAR_IDENTIFIER);
  const combinedIcuList = [];
  for (let listIndex = 0; listIndex < splitIcuString.length; listIndex++) {
    combinedIcuList.push(splitIcuString[listIndex]);
    if (listIndex < splitIcuString.length - 1) {
      combinedIcuList.push(
        `${VAR_IDENTIFIER}${2 * listIndex + 1}${VAR_FLAG_SUFFIX}`
      );
    }
  }
  const escapedIcuString = combinedIcuList.join('');

  // index start at 1, parity with GTJSON identifiers
  let index = 1;

  // Helper function to check if the child is a variable
  function shouldVisit(child: MessageFormatElement): child is Variable {
    return (
      child.type === TYPE.select &&
      VAR_FLAG_REGEX.test(child.value) &&
      !!child.options.other
    );
  }

  // Helper function to update the variable index
  function visitor(child: Variable): void {
    // Note the index of the variable in the list
    const listIndex = Number.parseInt(
      child.value.slice(VAR_IDENTIFIER.length, -VAR_FLAG_SUFFIX.length)
    );
    combinedIcuList[listIndex] = `${VAR_IDENTIFIER}${index}`;
    index += 1;
  }

  // Find all variable identifiers
  traverseIcu({
    icuString: escapedIcuString,
    shouldVisit,
    visitor,
    options: {
      recurseIntoVisited: false,
    },
  });

  // Reconstruct the ICU string, now with identifiers, filter out the escape suffix
  return combinedIcuList
    .map((part, listIndex) =>
      listIndex % 2 === 0
        ? part
        : part.replace(`${listIndex}${VAR_FLAG_SUFFIX}`, '')
    )
    .join('');
}
