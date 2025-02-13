import { hashJsxChildren as hashChildren } from 'generaltranslation/id';
import { JsxChildren } from 'generaltranslation/internal';

export function hashJsxChildren({
  source,
  context,
  id,
  hashFunction,
}: {
  source: JsxChildren;
  context?: string;
  id?: string;
  hashFunction?: (string: string, id?: string) => string;
}): string {
  return hashChildren({ source, context, hashFunction, ...(id && { id }) });
}
