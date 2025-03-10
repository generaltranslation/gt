import { CustomLoader } from 'gt-react/internal';
import { unresolvedCustomLoadTranslationsError } from '../errors/createErrors';

let customLoadTranslations: CustomLoader | undefined = undefined;

export default function resolveTranslationLoader(): CustomLoader | undefined {
  // Singleton pattern
  if (customLoadTranslations !== undefined) return customLoadTranslations;

  // Check: local translation loader is enabled
  if (process.env._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED !== 'true')
    return undefined;

  // get load translation file
  let customLoadTranslationsConfig;
  try {
    customLoadTranslationsConfig = require('gt-next/_load-translations');
  } catch {}

  // Get custom loader
  customLoadTranslations =
    customLoadTranslationsConfig?.default ||
    customLoadTranslationsConfig?.getLocalTranslation;

  // Check: custom loader is exported
  if (!customLoadTranslations) {
    // So the custom loader doesnt eval to falsey
    customLoadTranslations = async (_: string) => undefined;

    // Throw error in dev
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(unresolvedCustomLoadTranslationsError);
    }

    // Custom loader file was defined but not exported
    console.error(unresolvedCustomLoadTranslationsError);
  }

  return customLoadTranslations;
}
