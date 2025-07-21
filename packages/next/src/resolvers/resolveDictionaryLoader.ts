import { CustomLoader } from 'gt-react/internal';
import { unresolvedCustomLoadDictionaryError } from '../errors/createErrors';

let customLoadDictionary: CustomLoader | undefined = undefined;

export default function resolveDictionaryLoader(): CustomLoader | undefined {
  // Singleton pattern
  if (customLoadDictionary !== undefined) return customLoadDictionary;

  // Check: local dictionary loader is enabled
  if (process.env._GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED !== 'true')
    return;

  // get load dictionary file
  let customLoadDictionaryConfig;
  try {
    customLoadDictionaryConfig = require('gt-next/_load-dictionary');
  } catch {}

  // Get custom loader
  customLoadDictionary =
    customLoadDictionaryConfig?.default ||
    customLoadDictionaryConfig?.loadDictionary;

  // Check: custom loader is exported
  if (!customLoadDictionary) {
    // So the custom loader doesnt eval to falsey
    customLoadDictionary = async (_: string) => undefined;

    // Throw error in dev
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(unresolvedCustomLoadDictionaryError);
    }

    // Custom loader file was defined but not exported
    console.error(unresolvedCustomLoadDictionaryError);
  }

  return customLoadDictionary;
}
