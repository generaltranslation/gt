import { CustomLoader } from 'gt-react/internal';
import { unresolvedCustomLoadTranslationError } from '../errors/createErrors';

let customLoadTranslation: CustomLoader | undefined = undefined;

export default function resolveTranslationLoader(): CustomLoader | undefined {
  // Singleton pattern
  if (customLoadTranslation !== undefined) return customLoadTranslation;

  // Check: local translation loader is enabled
  if (process.env._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED !== 'true')
    return undefined;

  // get load translation file
  let customLoadTranslationConfig;
  try {
    customLoadTranslationConfig = require('gt-next/_load-translation');
  } catch {}

  // Get custom loader
  customLoadTranslation =
    customLoadTranslationConfig?.default ||
    customLoadTranslationConfig?.getLocalTranslation;

  // Check: custom loader is exported
  if (!customLoadTranslation) {
    // So the custom loader doesnt eval to falsey
    customLoadTranslation = async (_: string) => undefined;

    // Throw error in dev
    if (process.env.NODE_ENV !== 'production') {
      // throw new Error(unresolvedCustomLoadTranslationError);
    }

    // Custom loader file was defined but not exported
    console.error(unresolvedCustomLoadTranslationError);
  }

  return customLoadTranslation;
}
