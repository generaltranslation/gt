export default async function loadDictionary(locale: string) {
  try {
    const dictionary = await import(`./public/_gt/dictionaries/${locale}.json`);
    return dictionary.default;
  } catch {
    return {};
  }
}
