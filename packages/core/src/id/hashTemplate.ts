import { hashString } from './hashSource';
import { stableStringify as stringify } from '../utils/stableStringify';

export function hashTemplate(
  template: {
    [key: string]: string;
  },
  hashFunction = hashString
): string {
  return hashFunction(stringify(template));
}
