import { VAR_IDENTIFIER } from './constants';
import {
  PluralOrSelectOption,
  LiteralElement,
  SelectElement,
  Location,
} from '@formatjs/icu-messageformat-parser/types';

interface GTIndexedSelectOption extends PluralOrSelectOption {
  value: Array<LiteralElement>;
}

export interface GTIndexedSelectElement extends SelectElement {
  value: `${typeof VAR_IDENTIFIER}${number}`;
  options: {
    other: GTIndexedSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}

interface GTUnindexedSelectOption extends PluralOrSelectOption {
  value: Array<LiteralElement>;
}

export interface GTUnindexedSelectElement extends SelectElement {
  value: typeof VAR_IDENTIFIER;
  options: {
    other: GTUnindexedSelectOption;
    [key: string]: PluralOrSelectOption;
  };
}
