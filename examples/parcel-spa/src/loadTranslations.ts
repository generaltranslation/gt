// Parcel resolves dynamic imports by static analysis, so it does not support
// one interpolated dynamic import built from a template literal (the
// ./_gt/[locale].json form) the way Vite and webpack do (they treat it as a
// glob and emit a bundle per match). Each specifier here is a literal string,
// so Parcel still code-splits every locale into its own lazy chunk and fetches
// only the active one at runtime.
//
// Every locale in gt.config.json needs a matching entry here. A locale with no
// entry resolves to source strings (see the warning below).
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  zh: () => import('./_gt/zh.json'),
  fr: () => import('./_gt/fr.json'),
  es: () => import('./_gt/es.json'),
  ja: () => import('./_gt/ja.json'),
};

export async function loadTranslations(locale: string) {
  const load = loaders[locale];
  if (!load) {
    console.warn(
      `[gt] No translation loader for locale "${locale}". Add a matching ` +
        `entry to loaders in src/loadTranslations.ts. Falling back to source strings.`
    );
    return {};
  }
  try {
    const mod = await load();
    // Parcel imports a `.json` file as a CommonJS module (module.exports =
    // <object>) with no `__esModule` flag, so the dynamic import namespace is
    // the object itself and `.default` is undefined. Vite/webpack instead put
    // the object on `.default`. Handle both so the same source works anywhere.
    return (mod as { default?: unknown }).default ?? mod;
  } catch (error) {
    console.warn(
      `[gt] Failed to load translations for locale "${locale}". Falling back to source strings.`,
      error
    );
    return {};
  }
}
