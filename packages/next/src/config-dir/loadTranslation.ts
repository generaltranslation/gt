import { TranslationsObject } from 'gt-react/internal';
import {
  customLoadTranslationsError,
  remoteTranslationsError,
} from '../errors/createErrors';
import resolveTranslationLoader from '../loaders/resolveTranslationLoader';

type RemoteLoadTranslationsInput = {
  targetLocale: string;
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
};

let loadTranslationsFunction: (
  props: RemoteLoadTranslationsInput
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
export default async function loadTranslations(
  props: RemoteLoadTranslationsInput
): Promise<TranslationsObject | undefined> {
  // Singleton pattern
  if (loadTranslationsFunction) return await loadTranslationsFunction(props);

  // ----- CHECK FOR CUSTOM LOADER ----- //

  // get content loader
  const customLoadTranslations = resolveTranslationLoader();

  if (customLoadTranslations) {
    // ----- USING CUSTOM TRANSLATION LOADER ----- //

    // Set custom translation loader
    loadTranslationsFunction = async (_props: RemoteLoadTranslationsInput) => {
      // Load translation
      try {
        const result = await customLoadTranslations(_props.targetLocale);
        return parseResult(result);
      } catch (error) {
        console.error(customLoadTranslationsError(_props.targetLocale), error);
        return undefined;
      }
    };
  } else {
    // ----- USING REMOTE CACHE LOADER ----- //

    // Default translation loader: remote cache
    loadTranslationsFunction = async (
      _props: RemoteLoadTranslationsInput
    ): Promise<any> => {
      try {
        const response = await fetch(
          `${_props.cacheUrl}/${_props.projectId}/${_props.targetLocale}${
            _props._versionId ? `/${_props._versionId}` : ''
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
  return await loadTranslationsFunction(props);
}
