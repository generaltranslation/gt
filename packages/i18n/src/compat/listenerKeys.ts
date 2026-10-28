export type DictionaryListenerLookup = {
  locale: string;
  id: string;
};

export function getDictionaryListenerKey({
  locale,
  id,
}: DictionaryListenerLookup): string {
  return `${locale}:${id}`;
}
