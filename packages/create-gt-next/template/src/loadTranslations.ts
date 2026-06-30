export default function loadTranslations(locale: string) {
  return import(`../public/_gt/${locale}.json`).then((module) => {
    return module.default;
  });
}
