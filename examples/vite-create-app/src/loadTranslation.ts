export default async function loadTranslation(locale: string) {
  const t = await import(`./_gt/${locale}.json`);
  return t.default;
}
