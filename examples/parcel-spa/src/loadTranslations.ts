// Parcel resolves dynamic imports by static analysis, so an interpolated specifier
// (./_gt/[locale].json) does not work as it does in Vite or webpack. Each literal
// entry still code-splits; every locale in gt.config.json needs one here.
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
    // Parcel imports JSON as CommonJS with no `__esModule` flag, so the namespace is
    // the object itself; Vite and webpack put it on `.default`. Handle both.
    return (mod as { default?: unknown }).default ?? mod;
  } catch (error) {
    console.warn(
      `[gt] Failed to load translations for locale "${locale}". Falling back to source strings.`,
      error
    );
    return {};
  }
}
