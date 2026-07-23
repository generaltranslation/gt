import { createUnresolvedCustomLoadTranslationsError } from '../errors/loaders';

type CustomLoader = (locale: string) => Promise<unknown>;

let customLoadTranslations: CustomLoader | undefined = undefined;

export function resolveTranslationLoader(): CustomLoader | undefined {
  // Singleton pattern
  if (customLoadTranslations !== undefined) return customLoadTranslations;

  // Check: local translation loader is enabled
  if (process.env._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED !== 'true')
    return undefined;

  // get load translation file
  let customLoadTranslationsConfig;
  try {
    customLoadTranslationsConfig = require('gt-next/internal/_load-translations');
  } catch {
    // No custom translation loader module was generated.
  }

  // Get custom loader
  customLoadTranslations =
    customLoadTranslationsConfig?.default ||
    customLoadTranslationsConfig?.loadTranslations;

  // Check: custom loader is exported
  if (!customLoadTranslations) {
    // So the custom loader doesnt eval to falsey
    customLoadTranslations = async (_: string) => undefined;
    const unresolvedCustomLoadTranslationsError =
      createUnresolvedCustomLoadTranslationsError();

    // Throw error in dev
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(unresolvedCustomLoadTranslationsError);
    }

    // Custom loader file was defined but not exported
    console.error(unresolvedCustomLoadTranslationsError);
  }

  return customLoadTranslations;
}
