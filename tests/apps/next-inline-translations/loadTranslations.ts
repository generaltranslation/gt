// fr translations are embedded at build time (next.config.ts), so only its
// msg() strings load at runtime, from the file the CLI writes with
// files.gt.msgOutput
const EMBEDDED_LOCALES = ['fr'];

export default async function loadTranslations(locale: string) {
  const file = EMBEDDED_LOCALES.includes(locale) ? `${locale}.msg` : locale;
  const translations = await import(`./translations/${file}.json`);
  return translations.default;
}
