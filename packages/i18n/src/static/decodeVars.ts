import {
  LiteralElement,
  MessageFormatElement,
  PluralOrSelectOption,
  SelectElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser/types';
import { VAR_IDENTIFIER } from './utils/constants';
import { traverseIcu } from './utils/traverseIcu';

type Location = {
  start: number;
  end: number;
  value: string;
};

const VAR_IDENTIFIER_TEST = new RegExp(`^${VAR_IDENTIFIER}$`);

interface VariableOther extends PluralOrSelectOption {
  value: Array<LiteralElement>;
}

interface Variable extends SelectElement {
  type: TYPE.select;
  value: typeof VAR_IDENTIFIER;
  options: {
    other: VariableOther;
    [key: string]: PluralOrSelectOption;
  };
  location: NonNullable<SelectElement['location']>;
}

/**
 * Given an encoded ICU string, decode all the variables
 * decodeVars('Hi {_gt_, select, other {Brian}}, my name is {name}') => 'Hi Brian, my name is {name}'
 */
export function decodeVars(icuString: string): string {
  // Check if the string contains _gt_
  if (!icuString.includes(VAR_IDENTIFIER)) {
    return icuString;
  }

  // Check if the child is a variable
  function shouldVisit(child: MessageFormatElement): child is Variable {
    return (
      child.type === TYPE.select &&
      VAR_IDENTIFIER_TEST.test(child.value) &&
      !!child.location &&
      child.options.other &&
      child.options.other.value &&
      (child.options.other.value.length === 0 ||
        (child.options.other.value.length > 0 &&
          child.options.other.value[0].type === TYPE.literal))
    );
  }

  // Record the location of the variable
  const variableLocations: Location[] = [];
  function visitor(child: Variable): void {
    variableLocations.push({
      start: child.location.start.offset,
      end: child.location.end.offset,
      value:
        child.options.other.value.length > 0
          ? child.options.other.value[0].value
          : '',
    });
  }

  // Find all variable identifiers
  traverseIcu({
    icuString,
    shouldVisit,
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
