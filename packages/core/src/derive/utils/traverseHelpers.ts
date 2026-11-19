import { GT_UNINDEXED_IDENTIFIER_REGEX } from './regex';
import { GTUnindexedSelectElement } from './types';
import {
  TYPE,
  type MessageFormatElement,
} from '@generaltranslation/icu/parser';

// Visit any _gt_ select
export function isGTUnindexedSelectElement(
  child: MessageFormatElement
): child is GTUnindexedSelectElement {
  return (
    child.type === TYPE.select &&
    GT_UNINDEXED_IDENTIFIER_REGEX.test(child.value) &&
    !!child.options.other &&
    (child.options.other.value.length === 0 ||
      (child.options.other.value.length > 0 &&
        child.options.other.value[0]?.type === TYPE.literal))
  );
}
