// The whole catalog of a locale, as an app without chunk translations loads
// it. A build with chunk translations never calls this, and takes it out:
// the catalogs must not be chunks of that build.
const catalogs = import.meta.glob<{ default: object }>('@translations/*.json');

export async function loadTranslations(locale: string) {
  const catalog = Object.entries(catalogs).find(([file]) =>
    file.endsWith(`/${locale}.json`)
  );
  return catalog ? (await catalog[1]()).default : {};
}
