import { TranslationsObject } from 'gt-react/internal';
import {
  customLoadMessagesError,
  customLoadTranslationError,
  remoteTranslationsError,
} from '../errors/createErrors';
import resolveMessageLoader from '../loaders/resolveMessagesLoader';
import resolveTranslationLoader from '../loaders/resolveTranslationLoader';

type RemoteLoadTranslationInput = {
  targetLocale: string;
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
};

let loadTranslationFunction: (
  props: RemoteLoadTranslationInput
) => Promise<any>;

// parse translation result (local or remote)
function parseResult(result: any): TranslationsObject | undefined {
  if (result && Object.keys(result).length) {
    // Mark success
    const parsedResult: TranslationsObject = Object.entries(result).reduce(
      (translationsAcc: TranslationsObject, [hash, target]: [string, any]) => {
        translationsAcc[hash] = { state: 'success', target };
        return translationsAcc;
      },
      {}
    );
    return parsedResult;
  }
  return undefined;
}

/**
 * Loads the translations for the user's current locale.
 * Supports custom translation loaders.
 *
 * @returns {Promise<TranslationsObject | undefined>} The translation object or undefined if not found or errored
 *
 */
export default async function loadTranslation(
  props: RemoteLoadTranslationInput
): Promise<TranslationsObject | undefined> {
  // Singleton pattern
  if (loadTranslationFunction) return await loadTranslationFunction(props);

  // ----- CHECK FOR CUSTOM LOADER ----- //

  // get content loader
  const customLoadTranslation = resolveTranslationLoader();


  if (customLoadTranslation) {
    // ----- USING CUSTOM TRANSLATION LOADER ----- //

    // Set custom translation loader
    loadTranslationFunction = async (_: RemoteLoadTranslationInput) => {
      // Load translation
      try {
        const result = await customLoadTranslation(props.targetLocale);
        return parseResult(result); 
      } catch (error) {
        console.error(customLoadTranslationError, error);
        return undefined;
      }
    };

  } else {
    // ----- USING REMOTE CACHE LOADER ----- //

    // Default translation loader: remote cache
    loadTranslationFunction = async (
      props: RemoteLoadTranslationInput
    ): Promise<any> => {
      try {
        const response = await fetch(
          `${props.cacheUrl}/${props.projectId}/${props.targetLocale}${
            props._versionId ? `/${props._versionId}` : ''
          }`
        );
        const result = await response.json();
        return parseResult(result);
      } catch (error) {
        console.error(remoteTranslationsError, error);
        return undefined;
      }
    };
  }

  // Invoke the function
  return await loadTranslationFunction(props);
}
