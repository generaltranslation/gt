export default async function loadTranslations(locale: string) {
  const t = await import(`./content/ui.${locale}.json`);
  return t.default;
}
