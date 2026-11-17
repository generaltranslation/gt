// fr translations are embedded in production builds (gt.config.json), so only
// the rest of fr loads at runtime, from the file the CLI writes with
// files.gt.inlineTranslations.msgOutput. Dev builds embed nothing.
const EMBEDDED_LOCALES = ['fr'];

export default async function loadTranslations(locale: string) {
  const file =
    process.env.NODE_ENV === 'production' && EMBEDDED_LOCALES.includes(locale)
      ? `${locale}.msg`
      : locale;
  const translations = await import(`./translations/${file}.json`);
  return translations.default;
}
