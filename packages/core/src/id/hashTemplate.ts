import { hashString } from './hashSource';
import { stableStringify as stringify } from '../utils/stableStringify';

export default function hashTemplate(
  template: {
    [key: string]: string;
  },
  hashFunction = hashString
): string {
  return hashFunction(stringify(template));
}
