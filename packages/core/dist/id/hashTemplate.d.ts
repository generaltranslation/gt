import { hashString } from './hashJsxChildren';
export default function hashTemplate(
  template: {
    [key: string]: string;
  },
  hashFunction?: typeof hashString
): string;
