import {
  ArgumentElement,
  MessageFormatElement,
  SelectElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser/types';
import { printAST } from '@formatjs/icu-messageformat-parser/printer';
import { traverseIcu } from './traverseIcu';
import { VAR_IDENTIFIER } from './constants';

interface GTIndexedSelectElement extends SelectElement {
  value: `${typeof VAR_IDENTIFIER}${number}`;
}

interface GTIndexedArgumentElement extends ArgumentElement {
  value: `${typeof VAR_IDENTIFIER}${number}`;
}

// Regex  for _gt_# select
const GT_INDEXED_IDENTIFIER_REGEX = new RegExp(`^${VAR_IDENTIFIER}\\d+$`);

/**
 * Given an indexed ICU string, condenses any select to an argument
 * indexVars('Hello {_gt_1, select, other {World}}') => 'Hello {_gt_1}'
 * @param {string} icuString - The ICU string to condense.
 * @returns {string} The condensed ICU string.
 */
export function condenseVars(icuString: string): string {
  // Visit any _gt_# select
  function shouldVisit(
    child: MessageFormatElement
  ): child is GTIndexedSelectElement {
    return (
      child.type === TYPE.select &&
      GT_INDEXED_IDENTIFIER_REGEX.test(child.value)
    );
  }

  // Replace with argument
  function visitor(child: GTIndexedSelectElement): void {
    (child as unknown as GTIndexedArgumentElement).type = TYPE.argument;
    delete (child as any).options;
  }

  const ast = traverseIcu({
    icuString,
    shouldVisit,
    visitor,
    options: { recurseIntoVisited: false },
  });

  // Serialize
  // Can call parse here because this action should never be applied to a hash calculation
  // This means we don't have to worry about whitespace formatting being lost
  return printAST(ast);
}
