import {
  GT_INDEXED_IDENTIFIER_REGEX,
  GT_UNINDEXED_IDENTIFIER_REGEX,
} from './regex';
import { GTIndexedSelectElement, GTUnindexedSelectElement } from './types';
import {
  MessageFormatElement,
  TYPE,
} from '@formatjs/icu-messageformat-parser/types';

// Visit any _gt_# select
export function isGTIndexedSelectElement(
  child: MessageFormatElement
): child is GTIndexedSelectElement {
  return (
    child.type === TYPE.select &&
    GT_INDEXED_IDENTIFIER_REGEX.test(child.value) &&
    !!child.options.other &&
    (child.options.other.value.length === 0 ||
      (child.options.other.value.length > 0 &&
        child.options.other.value[0]?.type === TYPE.literal))
  );
}

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
