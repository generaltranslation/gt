// A loadTranslations of the app's own, for the build that scripts/check.mjs
// expects to fail: it returns other translations than the files the build
// reads.
export default async function loadTranslations(locale: string) {
  return locale === 'fr' ? { dc096214c9acd5c7: 'CUSTOM SETTINGS' } : {};
}
