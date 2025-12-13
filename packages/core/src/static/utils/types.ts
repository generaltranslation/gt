import { VAR_IDENTIFIER } from './constants';
import {
  PluralOrSelectOption,
  LiteralElement,
  SelectElement,
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
