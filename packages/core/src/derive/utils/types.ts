import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';
import type {
  PluralOrSelectOption,
  LiteralElement,
  SelectElement,
} from '@generaltranslation/icu/parser';

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
