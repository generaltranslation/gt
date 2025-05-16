export default async function loadTranslations(locale: string) {
  const t = await import(`./public/_gt/${locale}.json`);
  return t.default;
}
