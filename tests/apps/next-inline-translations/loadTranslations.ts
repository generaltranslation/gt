// fr translations are embedded at build time (gt.config.json), so only its
// msg() strings load at runtime, from the file the CLI writes with
// files.gt.inlineTranslations.msgOutput
const EMBEDDED_LOCALES = ['fr'];

export default async function loadTranslations(locale: string) {
  const file = EMBEDDED_LOCALES.includes(locale) ? `${locale}.msg` : locale;
  const translations = await import(`./translations/${file}.json`);
  return translations.default;
}
