export default async function loadTranslation(locale: string) {
  const t = await import(`../public/_gt/${locale}.json`);
  return t.default;
}
