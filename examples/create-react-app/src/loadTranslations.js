export default async function loadTranslations(locale) {
  const t = await import(`./locales/${locale}.json`);
  return t.default;
}
