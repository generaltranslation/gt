import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';
import type {
  PluralOrSelectOption,
  LiteralElement,
  SelectElement,
} from '@generaltranslation/icu/parser';

interface GTIndexedSelectOption extends PluralOrSelectOption {
  value: Array<LiteralElement>;
}

export interface GTIndexedSelectElement extends SelectElement {
  value: `${typeof RESERVED_NAME_PREFIX}${number}`;
  options: {
    other: GTIndexedSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}

interface GTUnindexedSelectOption extends PluralOrSelectOption {
  value: Array<LiteralElement>;
}

export interface GTUnindexedSelectElement extends SelectElement {
  value: typeof RESERVED_NAME_PREFIX;
  options: {
    other: GTUnindexedSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}
